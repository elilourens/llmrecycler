import { Hono } from "hono";
import { supabase } from "../supabase";
import { proxyAuthMiddleware, ProxyContext } from "../middleware/proxy-auth";
import { detectProvider } from "../utils/provider-detection";
import { getVaultSecret } from "../utils/vault-cache";
import { getPricing, calculateCosts } from "../utils/pricing";

const proxyRouter = new Hono();

// Apply buyer auth middleware
proxyRouter.use(proxyAuthMiddleware);

// Helper to get LRU seller key with FOR UPDATE SKIP LOCKED
async function selectLRUSellerKey(provider: string, excludeKeyIds: string[] = []) {
  try {
    const { data: keys, error } = await supabase.rpc("select_lru_seller_key", {
      p_provider: provider,
      p_exclude_ids: excludeKeyIds,
    });

    if (error) {
      console.error("Error selecting LRU key:", error);
      return null;
    }

    return keys?.length > 0 ? keys[0] : null;
  } catch (err) {
    console.error("Unexpected error selecting LRU key:", err);
    return null;
  }
}

// Helper to build provider-specific headers
function buildAuthHeader(provider: string, apiKey: string): Record<string, string> {
  switch (provider) {
    case "Anthropic":
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      };
    case "OpenAI":
      return { Authorization: `Bearer ${apiKey}` };
    case "Google":
      return { "x-goog-api-key": apiKey };
    case "DeepSeek":
      return { Authorization: `Bearer ${apiKey}` };
    default:
      return {};
  }
}

// Helper to extract provider-specific base URL
function getProviderBaseUrl(provider: string): string {
  switch (provider) {
    case "Anthropic":
      return "https://api.anthropic.com";
    case "OpenAI":
      return "https://api.openai.com";
    case "Google":
      return "https://generativelanguage.googleapis.com";
    case "DeepSeek":
      return "https://api.deepseek.com";
    default:
      return "";
  }
}

// Helper to extract token counts from provider response
function extractTokens(
  provider: string,
  response: any
): { inputTokens: number | null; outputTokens: number | null } {
  switch (provider) {
    case "Anthropic":
      return {
        inputTokens: response.usage?.input_tokens || null,
        outputTokens: response.usage?.output_tokens || null,
      };
    case "OpenAI":
      return {
        inputTokens: response.usage?.prompt_tokens || null,
        outputTokens: response.usage?.completion_tokens || null,
      };
    case "Google":
      return {
        inputTokens: response.usageMetadata?.promptTokenCount || null,
        outputTokens: response.usageMetadata?.candidatesTokenCount || null,
      };
    case "DeepSeek":
      return {
        inputTokens: response.usage?.prompt_tokens || null,
        outputTokens: response.usage?.completion_tokens || null,
      };
    default:
      return { inputTokens: null, outputTokens: null };
  }
}

// Helper to deactivate a seller key
async function deactivateSellerKey(sellerkeyId: string) {
  await supabase
    .from("seller_keys")
    .update({ status: "deactivated" })
    .eq("id", sellerkeyId);
}

// Helper to log request
async function logRequest(
  buyerKeyId: string,
  sellerKeyId: string | null,
  provider: string,
  model: string,
  statusCode: number | null,
  inputTokens: number | null,
  outputTokens: number | null,
  inputRate: number | null,
  outputRate: number | null,
  costUpstream: number | null,
  costCharged: number | null,
  sellerEarning: number | null,
  yourMargin: number | null,
  latencyMs: number,
  errorMessage: string | null = null
) {
  const { error } = await supabase.from("requests_log").insert({
    buyer_key_id: buyerKeyId,
    seller_key_id: sellerKeyId,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_rate_used: inputRate,
    output_rate_used: outputRate,
    cost_upstream: costUpstream,
    cost_charged: costCharged,
    seller_earning: sellerEarning,
    your_margin: yourMargin,
    status_code: statusCode,
    error_message: errorMessage,
    latency_ms: latencyMs,
  });

  if (error) {
    console.error("Error logging request:", error);
  }
}

// Main proxy handler - accepts any path and forwards transparently
proxyRouter.post("*", async (c: any) => {
  const startTime = Date.now();
  const proxyContext = c.get("proxyContext") as ProxyContext;

  try {
    // Parse request body
    let body: any;
    try {
      body = await c.req.json();
    } catch (err) {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Invalid JSON in request body",
          },
        },
        400
      );
    }

    const model = body.model;

    // 1. Validate model is provided
    if (!model || typeof model !== "string") {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Model parameter is required",
          },
        },
        400
      );
    }

    // 2. Detect provider from model name
    const provider = detectProvider(model);
    if (!provider) {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: `Unknown model: ${model}`,
          },
        },
        400
      );
    }

    // 3. Select LRU seller key
    let sellerKey = await selectLRUSellerKey(provider);
    if (!sellerKey) {
      const latencyMs = Date.now() - startTime;
      await logRequest(
        proxyContext.buyerKeyId,
        null,
        provider,
        model,
        503,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        latencyMs,
        "No available seller keys"
      );

      return c.json(
        {
          error: {
            type: "service_unavailable",
            message: "No available API keys for this provider",
          },
        },
        503
      );
    }

    // 4. Fetch vault secret (decryption happens inside Postgres)
    const apiKey = await getVaultSecret(sellerKey.id);
    if (!apiKey) {
      const latencyMs = Date.now() - startTime;
      await logRequest(
        proxyContext.buyerKeyId,
        sellerKey.id,
        provider,
        model,
        500,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        latencyMs,
        "Failed to retrieve API key from vault"
      );

      return c.json(
        {
          error: {
            type: "internal_error",
            message: "Failed to retrieve API key",
          },
        },
        500
      );
    }

    // 5. Get pricing information
    const pricing = await getPricing(provider, model);
    if (!pricing) {
      const latencyMs = Date.now() - startTime;
      await logRequest(
        proxyContext.buyerKeyId,
        sellerKey.id,
        provider,
        model,
        500,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        latencyMs,
        "No pricing found for model"
      );

      return c.json(
        {
          error: {
            type: "internal_error",
            message: "Pricing not configured for this model",
          },
        },
        500
      );
    }

    // 6. Build upstream request - use exact path from request
    const baseUrl = getProviderBaseUrl(provider);
    const path = c.req.path.replace(/^\/api\/proxy/, "");
    const upstreamUrl = `${baseUrl}${path}`;

    const authHeaders = buildAuthHeader(provider, apiKey);
    const requestBody = JSON.stringify(body);

    // 7. Forward request to provider
    let upstreamResponse: Response;

    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: c.req.method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: requestBody,
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      console.error("Error forwarding request to provider:", err);
      await logRequest(
        proxyContext.buyerKeyId,
        sellerKey.id,
        provider,
        model,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        latencyMs,
        `Network error: ${err instanceof Error ? err.message : "Unknown error"}`
      );

      return c.json(
        {
          error: {
            type: "service_unavailable",
            message: "Provider service temporarily unavailable",
          },
        },
        503
      );
    }

    // 8. Handle error responses from provider
    if (!upstreamResponse.ok) {
      const errorBody = await upstreamResponse.text();
      const latencyMs = Date.now() - startTime;
      const statusCode = upstreamResponse.status;

      // Handle rate limiting (429)
      if (statusCode === 429) {
        if (provider !== "DeepSeek") {
          // Disable key on rate limit (except DeepSeek - just skip it)
          await deactivateSellerKey(sellerKey.id);
        }

        await logRequest(
          proxyContext.buyerKeyId,
          sellerKey.id,
          provider,
          model,
          statusCode,
          null,
          null,
          pricing.inputRate,
          pricing.outputRate,
          null,
          null,
          null,
          null,
          latencyMs,
          "Rate limited"
        );

        return new Response(errorBody, {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle out of credit (402)
      if (statusCode === 402) {
        // Suspend indefinitely
        await supabase
          .from("seller_keys")
          .update({ suspended_until: null })
          .eq("id", sellerKey.id);

        await logRequest(
          proxyContext.buyerKeyId,
          sellerKey.id,
          provider,
          model,
          statusCode,
          null,
          null,
          pricing.inputRate,
          pricing.outputRate,
          null,
          null,
          null,
          null,
          latencyMs,
          "Out of credit"
        );

        return new Response(errorBody, {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle invalid key (401/403)
      if (statusCode === 401 || statusCode === 403) {
        await deactivateSellerKey(sellerKey.id);

        await logRequest(
          proxyContext.buyerKeyId,
          sellerKey.id,
          provider,
          model,
          statusCode,
          null,
          null,
          pricing.inputRate,
          pricing.outputRate,
          null,
          null,
          null,
          null,
          latencyMs,
          "Invalid or expired key"
        );

        return new Response(errorBody, {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Other errors - pass through
      await logRequest(
        proxyContext.buyerKeyId,
        sellerKey.id,
        provider,
        model,
        statusCode,
        null,
        null,
        pricing.inputRate,
        pricing.outputRate,
        null,
        null,
        null,
        null,
        latencyMs,
        errorBody
      );

      return new Response(errorBody, {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 9. Check if response is streaming (has Content-Type: text/event-stream)
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isStreaming = contentType.includes("text/event-stream");

    if (isStreaming) {
      // 10. Handle streaming response
      const latencyMs = Date.now() - startTime;

      // For streaming, we need to:
      // 1. Pipe response to client
      // 2. Buffer the final message to extract tokens
      // 3. Log the request with tokens

      // Clone the response for reading and streaming
      const reader = upstreamResponse.body?.getReader();
      if (!reader) {
        await logRequest(
          proxyContext.buyerKeyId,
          sellerKey.id,
          provider,
          model,
          200,
          null,
          null,
          pricing.inputRate,
          pricing.outputRate,
          null,
          null,
          null,
          null,
          latencyMs,
          "No stream body"
        );
        return new Response("No stream body", { status: 500 });
      }

      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let lastChunk: string = "";

      // Create a transform stream that:
      // 1. Pipes chunks to client in real-time
      // 2. Buffers the final chunk for token extraction
      const { readable, writable } = new TransformStream({
        transform: async (chunk: Uint8Array, controller) => {
          const text = new TextDecoder().decode(chunk);

          // Save last chunk for token extraction
          lastChunk = text;

          // Send to client immediately
          controller.enqueue(chunk);
        },
      });

      // Pipe upstream response through transform
      upstreamResponse.body?.pipeTo(writable).catch((err) => {
        console.error("Error piping stream:", err);
      });

      // Extract tokens from last chunk
      if (lastChunk) {
        try {
          // Last chunk might have format like: data: {"usage": {...}}
          const lines = lastChunk.split("\n");
          const lastLine = lines[lines.length - 1] || lines[lines.length - 2];
          if (lastLine?.startsWith("data: ")) {
            const dataStr = lastLine.replace("data: ", "").trim();
            const finalData = JSON.parse(dataStr);
            const tokens = extractTokens(provider, finalData);
            inputTokens = tokens.inputTokens;
            outputTokens = tokens.outputTokens;
          }
        } catch (err) {
          console.debug("Could not extract tokens from stream");
        }
      }

      // Calculate costs if we have tokens
      let costUpstream: number | null = null;
      let costCharged: number | null = null;
      let sellerEarning: number | null = null;
      let yourMargin: number | null = null;

      if (inputTokens !== null && outputTokens !== null) {
        const costs = calculateCosts(
          inputTokens,
          outputTokens,
          pricing.inputRate,
          pricing.outputRate
        );
        costUpstream = costs.costUpstream;
        costCharged = costs.costCharged;
        sellerEarning = costs.sellerEarning;
        yourMargin = costs.yourMargin;
      }

      // Update last_checked_at
      await supabase
        .from("seller_keys")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", sellerKey.id);

      // Log streaming request
      await logRequest(
        proxyContext.buyerKeyId,
        sellerKey.id,
        provider,
        model,
        200,
        inputTokens,
        outputTokens,
        pricing.inputRate,
        pricing.outputRate,
        costUpstream,
        costCharged,
        sellerEarning,
        yourMargin,
        latencyMs
      );

      // Return streaming response to client
      return new Response(readable, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    } else {
      // 11. Handle non-streaming response (JSON)
      const responseText = await upstreamResponse.text();
      const latencyMs = Date.now() - startTime;

      let responseData: any = {};
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;

      try {
        responseData = JSON.parse(responseText);
        const tokens = extractTokens(provider, responseData);
        inputTokens = tokens.inputTokens;
        outputTokens = tokens.outputTokens;
      } catch (err) {
        console.error("Error parsing response JSON:", err);
      }

      // 12. Calculate costs
      let costUpstream: number | null = null;
      let costCharged: number | null = null;
      let sellerEarning: number | null = null;
      let yourMargin: number | null = null;

      if (inputTokens !== null && outputTokens !== null) {
        const costs = calculateCosts(
          inputTokens,
          outputTokens,
          pricing.inputRate,
          pricing.outputRate
        );
        costUpstream = costs.costUpstream;
        costCharged = costs.costCharged;
        sellerEarning = costs.sellerEarning;
        yourMargin = costs.yourMargin;
      }

      // 13. Update seller key last_checked_at
      await supabase
        .from("seller_keys")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", sellerKey.id);

      // 14. Log request
      await logRequest(
        proxyContext.buyerKeyId,
        sellerKey.id,
        provider,
        model,
        200,
        inputTokens,
        outputTokens,
        pricing.inputRate,
        pricing.outputRate,
        costUpstream,
        costCharged,
        sellerEarning,
        yourMargin,
        latencyMs
      );

      // 15. Return response to buyer
      return c.json(responseData, 200);
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error("Unexpected error in proxy:", err);

    await logRequest(
      proxyContext.buyerKeyId,
      null,
      "unknown",
      "unknown",
      500,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      latencyMs,
      err instanceof Error ? err.message : "Unknown error"
    );

    return c.json(
      {
        error: {
          type: "internal_error",
          message: "An unexpected error occurred",
        },
      },
      500
    );
  }
});

export default proxyRouter;
