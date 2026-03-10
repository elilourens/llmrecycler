import { Hono } from "hono";
import { supabase } from "../supabase";
import { proxyAuthMiddleware, ProxyContext } from "../middleware/proxy-auth";
import { detectProvider } from "../utils/provider-detection";
import { getVaultSecret } from "../utils/vault-cache";
import { getPricing, calculateCosts } from "../utils/pricing";

const proxyRouter = new Hono();

// Apply buyer auth middleware
proxyRouter.use(proxyAuthMiddleware);

const MAX_KEY_RETRIES = 3;

// --- Helpers ---

async function selectLRUSellerKey(provider: string, excludeKeyIds: string[] = []) {
  try {
    const { data: keys, error } = await supabase.rpc("select_lru_seller_key", {
      p_provider: provider,
      p_exclude_ids: excludeKeyIds,
    });
    if (error) { console.error("Error selecting LRU key:", error); return null; }
    return keys?.length > 0 ? keys[0] : null;
  } catch (err) {
    console.error("Unexpected error selecting LRU key:", err);
    return null;
  }
}

function buildAuthHeader(provider: string, apiKey: string): Record<string, string> {
  switch (provider) {
    case "Anthropic": return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    case "OpenAI":    return { Authorization: `Bearer ${apiKey}` };
    case "Google":    return { "x-goog-api-key": apiKey };
    case "DeepSeek":  return { Authorization: `Bearer ${apiKey}` };
    default:          return {};
  }
}

function getProviderBaseUrl(provider: string): string {
  switch (provider) {
    case "Anthropic": return "https://api.anthropic.com";
    case "OpenAI":    return "https://api.openai.com";
    case "Google":    return "https://generativelanguage.googleapis.com";
    case "DeepSeek":  return "https://api.deepseek.com";
    default:          return "";
  }
}

function extractTokens(
  provider: string,
  response: any
): { inputTokens: number | null; outputTokens: number | null } {
  switch (provider) {
    case "Anthropic":
      return { inputTokens: response.usage?.input_tokens || null, outputTokens: response.usage?.output_tokens || null };
    case "OpenAI":
      return { inputTokens: response.usage?.prompt_tokens || null, outputTokens: response.usage?.completion_tokens || null };
    case "Google":
      return { inputTokens: response.usageMetadata?.promptTokenCount || null, outputTokens: response.usageMetadata?.candidatesTokenCount || null };
    case "DeepSeek":
      return { inputTokens: response.usage?.prompt_tokens || null, outputTokens: response.usage?.completion_tokens || null };
    default:
      return { inputTokens: null, outputTokens: null };
  }
}

async function deactivateSellerKey(sellerKeyId: string) {
  await supabase.from("seller_keys").update({ status: "deactivated" }).eq("id", sellerKeyId);
}

interface LogRequestOptions {
  buyerKeyId: string;
  sellerKeyId?: string | null;
  provider: string;
  model: string;
  statusCode?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  inputRate?: number | null;
  outputRate?: number | null;
  costUpstream?: number | null;
  costCharged?: number | null;
  sellerEarning?: number | null;
  yourMargin?: number | null;
  latencyMs: number;
  errorMessage?: string | null;
}

async function logRequest(opts: LogRequestOptions) {
  const { error } = await supabase.from("requests_log").insert({
    buyer_key_id: opts.buyerKeyId,
    seller_key_id: opts.sellerKeyId ?? null,
    provider: opts.provider,
    model: opts.model,
    input_tokens: opts.inputTokens ?? null,
    output_tokens: opts.outputTokens ?? null,
    input_rate_used: opts.inputRate ?? null,
    output_rate_used: opts.outputRate ?? null,
    cost_upstream: opts.costUpstream ?? null,
    cost_charged: opts.costCharged ?? null,
    seller_earning: opts.sellerEarning ?? null,
    your_margin: opts.yourMargin ?? null,
    status_code: opts.statusCode ?? null,
    error_message: opts.errorMessage ?? null,
    latency_ms: opts.latencyMs,
  });
  if (error) console.error("Error logging request:", error);
}

async function computeFinalCosts(
  provider: string,
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
  basePricing: { inputRate: number; outputRate: number }
) {
  if (inputTokens === null || outputTokens === null) {
    return { inputRate: basePricing.inputRate, outputRate: basePricing.outputRate, costUpstream: null, costCharged: null, sellerEarning: null, yourMargin: null };
  }
  const actualPricing = (await getPricing(provider, model, inputTokens)) ?? basePricing;
  const costs = calculateCosts(inputTokens, outputTokens, actualPricing.inputRate, actualPricing.outputRate);
  return { inputRate: actualPricing.inputRate, outputRate: actualPricing.outputRate, ...costs };
}

// --- Main proxy handler ---

proxyRouter.post("*", async (c: any) => {
  const startTime = Date.now();
  const proxyContext = c.get("proxyContext") as ProxyContext;
  let provider = "unknown";
  let model = "unknown";

  try {
    // Parse request body
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { type: "invalid_request_error", message: "Invalid JSON in request body" } }, 400);
    }

    model = body.model;
    if (!model || typeof model !== "string") {
      return c.json({ error: { type: "invalid_request_error", message: "Model parameter is required" } }, 400);
    }

    const detectedProvider = detectProvider(model);
    if (!detectedProvider) {
      return c.json({ error: { type: "invalid_request_error", message: `Unknown model: ${model}` } }, 400);
    }
    provider = detectedProvider;

    const path = c.req.path.replace(/^\/api\/proxy/, "");
    const upstreamUrl = `${getProviderBaseUrl(provider)}${path}`;
    const requestBody = JSON.stringify(body);
    const excludedKeyIds: string[] = [];

    for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
      // Select LRU key, excluding previously failed ones
      const sellerKey = await selectLRUSellerKey(provider, excludedKeyIds);
      if (!sellerKey) {
        await logRequest({
          buyerKeyId: proxyContext.buyerKeyId,
          provider,
          model,
          statusCode: 503,
          latencyMs: Date.now() - startTime,
          errorMessage: "No available seller keys",
        });
        return c.json({ error: { type: "service_unavailable", message: "No available API keys for this provider" } }, 503);
      }

      // Fetch vault secret + pricing in parallel (independent operations)
      const [apiKey, pricing] = await Promise.all([
        getVaultSecret(sellerKey.id),
        getPricing(provider, model),
      ]);

      if (!apiKey) {
        await logRequest({
          buyerKeyId: proxyContext.buyerKeyId,
          sellerKeyId: sellerKey.id,
          provider,
          model,
          statusCode: 500,
          latencyMs: Date.now() - startTime,
          errorMessage: "Failed to retrieve API key from vault",
        });
        return c.json({ error: { type: "internal_error", message: "Failed to retrieve API key" } }, 500);
      }

      if (!pricing) {
        await logRequest({
          buyerKeyId: proxyContext.buyerKeyId,
          sellerKeyId: sellerKey.id,
          provider,
          model,
          statusCode: 500,
          latencyMs: Date.now() - startTime,
          errorMessage: "No pricing found for model",
        });
        return c.json({ error: { type: "internal_error", message: "Pricing not configured for this model" } }, 500);
      }

      // Forward request to provider
      let upstreamResponse: Response;
      try {
        upstreamResponse = await fetch(upstreamUrl, {
          method: c.req.method,
          headers: { "Content-Type": "application/json", ...buildAuthHeader(provider, apiKey) },
          body: requestBody,
        });
      } catch (err) {
        await logRequest({
          buyerKeyId: proxyContext.buyerKeyId,
          sellerKeyId: sellerKey.id,
          provider,
          model,
          latencyMs: Date.now() - startTime,
          errorMessage: `Network error: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return c.json({ error: { type: "service_unavailable", message: "Provider service temporarily unavailable" } }, 503);
      }

      // Success path
      if (upstreamResponse.ok) {
        const contentType = upstreamResponse.headers.get("content-type") || "";
        const isStreaming = contentType.includes("text/event-stream");

        // Update last_checked_at (fire-and-forget)
        supabase.from("seller_keys").update({ last_checked_at: new Date().toISOString() }).eq("id", sellerKey.id);

        if (isStreaming) {
          const latencyMs = Date.now() - startTime;
          let lastUsageData: any = null;

          // Parse usage from each SSE chunk in the transform; log when stream closes
          const { readable, writable } = new TransformStream({
            transform(chunk: Uint8Array, controller) {
              controller.enqueue(chunk);
              const text = new TextDecoder().decode(chunk);
              for (const line of text.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.usage || parsed.usageMetadata) lastUsageData = parsed;
                } catch {}
              }
            },
            flush() {
              // Stream complete — log in background (non-blocking)
              const tokens = lastUsageData
                ? extractTokens(provider, lastUsageData)
                : { inputTokens: null, outputTokens: null };
              computeFinalCosts(provider, model, tokens.inputTokens, tokens.outputTokens, pricing).then((costs) => {
                logRequest({
                  buyerKeyId: proxyContext.buyerKeyId,
                  sellerKeyId: sellerKey.id,
                  provider,
                  model,
                  statusCode: 200,
                  inputTokens: tokens.inputTokens,
                  outputTokens: tokens.outputTokens,
                  inputRate: costs.inputRate,
                  outputRate: costs.outputRate,
                  costUpstream: costs.costUpstream,
                  costCharged: costs.costCharged,
                  sellerEarning: costs.sellerEarning,
                  yourMargin: costs.yourMargin,
                  latencyMs,
                });
              });
            },
          });

          upstreamResponse.body!.pipeTo(writable).catch((err) => console.error("Error piping stream:", err));

          return new Response(readable, {
            status: upstreamResponse.status,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache",
              "X-Accel-Buffering": "no",
            },
          });
        } else {
          // Non-streaming JSON response
          const responseText = await upstreamResponse.text();
          const latencyMs = Date.now() - startTime;

          let responseData: any = {};
          let tokens = { inputTokens: null as number | null, outputTokens: null as number | null };
          try {
            responseData = JSON.parse(responseText);
            tokens = extractTokens(provider, responseData);
          } catch {
            console.error("Error parsing response JSON");
          }

          const costs = await computeFinalCosts(provider, model, tokens.inputTokens, tokens.outputTokens, pricing);
          await logRequest({
            buyerKeyId: proxyContext.buyerKeyId,
            sellerKeyId: sellerKey.id,
            provider,
            model,
            statusCode: 200,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
            inputRate: costs.inputRate,
            outputRate: costs.outputRate,
            costUpstream: costs.costUpstream,
            costCharged: costs.costCharged,
            sellerEarning: costs.sellerEarning,
            yourMargin: costs.yourMargin,
            latencyMs,
          });

          return c.json(responseData, 200);
        }
      }

      // Provider returned a key-level error — retry with next key
      const statusCode = upstreamResponse.status;
      const errorBody = await upstreamResponse.text();

      if (statusCode === 429) {
        if (provider !== "DeepSeek") await deactivateSellerKey(sellerKey.id);
        excludedKeyIds.push(sellerKey.id);
        continue;
      }

      if (statusCode === 402) {
        // Intentional: null = free-tier keys permanently blocked by LRU filter
        await supabase.from("seller_keys").update({ suspended_until: null }).eq("id", sellerKey.id);
        excludedKeyIds.push(sellerKey.id);
        continue;
      }

      if (statusCode === 401 || statusCode === 403) {
        await deactivateSellerKey(sellerKey.id);
        excludedKeyIds.push(sellerKey.id);
        continue;
      }

      // Non-key error (client 4xx, provider 5xx) — pass through immediately
      await logRequest({
        buyerKeyId: proxyContext.buyerKeyId,
        sellerKeyId: sellerKey.id,
        provider,
        model,
        statusCode,
        inputRate: pricing.inputRate,
        outputRate: pricing.outputRate,
        latencyMs: Date.now() - startTime,
        errorMessage: errorBody,
      });
      return new Response(errorBody, { status: statusCode, headers: { "Content-Type": "application/json" } });
    }

    // All retries exhausted — every available key failed
    await logRequest({
      buyerKeyId: proxyContext.buyerKeyId,
      provider,
      model,
      statusCode: 503,
      latencyMs: Date.now() - startTime,
      errorMessage: "All available seller keys exhausted",
    });
    return c.json({ error: { type: "service_unavailable", message: "No available API keys for this provider" } }, 503);

  } catch (err) {
    console.error("Unexpected error in proxy:", err);
    await logRequest({
      buyerKeyId: proxyContext.buyerKeyId,
      provider,
      model,
      statusCode: 500,
      latencyMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
    return c.json({ error: { type: "internal_error", message: "An unexpected error occurred" } }, 500);
  }
});

export default proxyRouter;
