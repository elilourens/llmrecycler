import { Hono } from "hono";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

function getProviderEndpointPath(provider: string, model: string, requestPath: string, isStreaming: boolean = false): string {
  // If the request already has a full path, use provider-specific mapping
  if (provider === "Google") {
    // Google uses different endpoints for streaming vs non-streaming
    const endpoint = isStreaming ? "streamGenerateContent" : "generateContent";
    return `/v1beta/models/${model}:${endpoint}`;
  }
  // All others use the path as-is
  return requestPath;
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

function convertGoogleStreamToOpenAI(googleChunk: any): any {
  // Convert Google's streaming format to OpenAI format
  if (!googleChunk.candidates || !googleChunk.candidates[0]) {
    console.log("🔍 Google chunk missing candidates:", JSON.stringify(googleChunk).slice(0, 200));
    return null;
  }

  const candidate = googleChunk.candidates[0];
  const content = candidate.content?.parts?.[0]?.text || "";

  if (!content) {
    console.log("🔍 Google chunk has no text content:", JSON.stringify(candidate).slice(0, 200));
    return null;
  }

  console.log("✅ Extracted text from Google stream:", content.slice(0, 50));

  // Return OpenAI-compatible format
  return {
    choices: [
      {
        delta: { content },
        index: 0,
      },
    ],
  };
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

      // Fetch vault secret + pricing in parallel
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

      // Update last_checked_at (fire-and-forget)
      supabase.from("seller_keys").update({ last_checked_at: new Date().toISOString() }).eq("id", sellerKey.id);

      // Route to appropriate handler
      try {
        if (provider === "Google") {
          return await handleGoogleRequest(c, body, apiKey, model, pricing, proxyContext, startTime, sellerKey.id);
        }
        return await handleHttpRequest(c, body, provider, apiKey, model, pricing, proxyContext, startTime, sellerKey.id);
      } catch (err: any) {
        // Handle key-level errors and retry
        if (err.status === 429) {
          if (provider !== "DeepSeek") await deactivateSellerKey(sellerKey.id);
          excludedKeyIds.push(sellerKey.id);
          continue;
        }
        if (err.status === 402) {
          await supabase.from("seller_keys").update({ suspended_until: null }).eq("id", sellerKey.id);
          excludedKeyIds.push(sellerKey.id);
          continue;
        }
        if (err.status === 401 || err.status === 403) {
          await deactivateSellerKey(sellerKey.id);
          excludedKeyIds.push(sellerKey.id);
          continue;
        }
        // Non-retryable error
        throw err;
      }
    }

    // All retries exhausted
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

// --- Google handler using official SDK ---

async function handleGoogleRequest(c: any, body: any, apiKey: string, model: string, pricing: any, proxyContext: ProxyContext, startTime: number, sellerKeyId: string) {
  const isStreaming = body.stream === true;
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({ model });

  // Build messages in Google format
  const contents = body.messages?.map((msg: any) => {
    const content = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
    return {
      role: msg.role === "user" ? "user" : "model",
      parts: content.map((item: any) => {
        if (item.type === "text") return { text: item.text };
        if (item.type === "image_url" && item.image_url?.url) {
          const url = item.image_url.url;
          if (url.startsWith("data:")) {
            const [header, base64] = url.split(",");
            const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
            return { inlineData: { mimeType, data: base64 } };
          }
        }
        return item;
      }),
    };
  }) || [];

  const latencyMs = Date.now() - startTime;

  try {
    if (isStreaming) {
      // Streaming response using ReadableStream
      const stream = await genModel.generateContentStream({ contents });
      const encoder = new TextEncoder();
      let lastUsageData: any = null;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream.stream) {
              if (chunk.usageMetadata) lastUsageData = chunk;

              const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (text) {
                // Convert to OpenAI format
                const openaiChunk = {
                  choices: [{ delta: { content: text }, index: 0 }],
                };
                const line = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                controller.enqueue(encoder.encode(line));
              }
            }

            // Send [DONE] signal
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();

            // Log after stream completes
            const tokens = lastUsageData ? extractTokens("Google", lastUsageData) : { inputTokens: null, outputTokens: null };
            const costs = await computeFinalCosts("Google", model, tokens.inputTokens, tokens.outputTokens, pricing);
            await logRequest({
              buyerKeyId: proxyContext.buyerKeyId,
              sellerKeyId,
              provider: "Google",
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
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    } else {
      // Non-streaming response
      const result = await genModel.generateContent({ contents });
      const tokens = extractTokens("Google", result.response);
      const costs = await computeFinalCosts("Google", model, tokens.inputTokens, tokens.outputTokens, pricing);

      await logRequest({
        buyerKeyId: proxyContext.buyerKeyId,
        sellerKeyId,
        provider: "Google",
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

      // Convert to OpenAI-compatible response format
      const responseData = {
        id: "google-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: result.response.text(),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: tokens.inputTokens,
          completion_tokens: tokens.outputTokens,
          total_tokens: (tokens.inputTokens || 0) + (tokens.outputTokens || 0),
        },
      };

      return c.json(responseData, 200);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Detect 429 rate limit errors - check both status property and message
    const status = (err as any)?.status === 429 || errorMessage.includes("429") ? 429 : 500;

    await logRequest({
      buyerKeyId: proxyContext.buyerKeyId,
      sellerKeyId,
      provider: "Google",
      model,
      statusCode: status,
      latencyMs,
      errorMessage,
    });
    throw { status, message: errorMessage };
  }
}

// --- HTTP handler for all providers ---

function convertRequestForProvider(provider: string, body: any): any {
  // OpenAI/DeepSeek format stays as-is
  if (provider === "OpenAI" || provider === "DeepSeek") {
    return body;
  }

  // Convert to Anthropic format
  if (provider === "Anthropic") {
    return {
      model: body.model,
      max_tokens: body.max_tokens || 1024,
      system: body.system,
      messages: body.messages?.map((msg: any) => ({
        role: msg.role,
        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }],
      })) || [],
    };
  }

  // Convert to Google format
  if (provider === "Google") {
    return {
      contents: body.messages?.map((msg: any) => {
        const content = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
        return {
          role: msg.role === "user" ? "user" : "model",
          parts: content.map((item: any) => {
            if (item.type === "text") return { text: item.text };
            if (item.type === "image_url" && item.image_url?.url) {
              const url = item.image_url.url;
              if (url.startsWith("data:")) {
                const [header, base64] = url.split(",");
                const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
                return { inlineData: { mimeType, data: base64 } };
              }
            }
            return item;
          }),
        };
      }) || [],
      generationConfig: { maxOutputTokens: body.max_tokens || 1024 },
    };
  }

  return body;
}

async function handleHttpRequest(c: any, body: any, provider: string, apiKey: string, model: string, pricing: any, proxyContext: ProxyContext, startTime: number, sellerKeyId: string) {
  const path = c.req.path.replace(/^\/api\/proxy/, "");
  const isStreaming = body.stream === true;
  const endpointPath = getProviderEndpointPath(provider, model, path, isStreaming);
  let upstreamUrl = `${getProviderBaseUrl(provider)}${endpointPath}`;

  // Google requires API key as query parameter
  if (provider === "Google") {
    upstreamUrl += `?key=${apiKey}`;
  }

  const convertedBody = convertRequestForProvider(provider, body);
  const requestBody = JSON.stringify(convertedBody);
  const latencyMs = Date.now() - startTime;

  const upstreamResponse = await fetch(upstreamUrl, {
    method: c.req.method,
    headers: {
      "Content-Type": "application/json",
      // Skip auth header for Google (using query param instead)
      ...(provider !== "Google" ? buildAuthHeader(provider, apiKey) : {})
    },
    body: requestBody,
  });

  if (upstreamResponse.ok) {
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isStreaming = contentType.includes("text/event-stream");

    if (isStreaming) {
      let lastUsageData: any = null;

      const { readable, writable } = new TransformStream({
        transform(chunk: Uint8Array, controller) {
          const text = new TextDecoder().decode(chunk);
          if (provider === "Google") console.log("📦 Google stream chunk:", text.slice(0, 300));

          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.usage || parsed.usageMetadata) lastUsageData = parsed;

              // Convert Google's format to OpenAI format if needed
              const toSend = provider === "Google" ? convertGoogleStreamToOpenAI(parsed) : parsed;
              if (toSend) {
                const openaiFormat = `data: ${JSON.stringify(toSend)}\n\n`;
                controller.enqueue(new TextEncoder().encode(openaiFormat));
              }
            } catch {}
          }
        },
        flush(controller) {
          // Send [DONE] signal for streaming completion
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));

          const tokens = lastUsageData ? extractTokens(provider, lastUsageData) : { inputTokens: null, outputTokens: null };
          computeFinalCosts(provider, model, tokens.inputTokens, tokens.outputTokens, pricing).then((costs) => {
            logRequest({
              buyerKeyId: proxyContext.buyerKeyId,
              sellerKeyId,
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
      const responseText = await upstreamResponse.text();
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
        sellerKeyId,
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
  } else {
    const statusCode = upstreamResponse.status;
    const errorBody = await upstreamResponse.text();
    await logRequest({
      buyerKeyId: proxyContext.buyerKeyId,
      sellerKeyId,
      provider,
      model,
      statusCode,
      inputRate: pricing.inputRate,
      outputRate: pricing.outputRate,
      latencyMs,
      errorMessage: errorBody,
    });
    throw { status: statusCode, message: errorBody };
  }
}

export default proxyRouter;
