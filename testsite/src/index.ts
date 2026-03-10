import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";

const app = new Hono();

const BUYER_API_KEY =
  "lmr_cac8531649eecbf25e8a68d945bd475293c460c6403cc9f28c044eceb80e26c8";
const PROXY_URL = "http://localhost:3001/api/proxy";

// Enable CORS for all routes
app.use("*", cors());

// Serve static files (index.html)
app.get("/", serveStatic({ path: "index.html" }));

// Helper: Build content array with text and images
function buildContent(message: string, images: Array<{ base64: string; mimeType: string }>, provider: string) {
  const content: any[] = [{ type: "text", text: message }];

  if (images && images.length > 0) {
    if (provider === "anthropic") {
      // Anthropic format
      images.forEach((img) => {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType,
            data: img.base64,
          },
        });
      });
    } else {
      // OpenAI format (works for OpenAI, Gemini, Grok, DeepSeek)
      images.forEach((img) => {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
          },
        });
      });
    }
  }

  return content;
}

// Helper: forward request, streaming or not
async function forwardRequest(
  c: any,
  upstreamPath: string,
  requestBody: object,
  label: string
) {
  const stream = c.req.query("stream") === "true";
  console.log(`🧪 Testing ${label} proxy... (stream=${stream})`);

  const body = stream ? { ...requestBody, stream: true } : requestBody;

  const response = await fetch(`${PROXY_URL}${upstreamPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": BUYER_API_KEY },
    body: JSON.stringify(body),
  });

  if (stream) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const data = await response.json();
  return c.json({ status: response.status, data });
}

// Test OpenAI
app.post("/test/openai", async (c) => {
  const body = await c.req.json();
  const content = buildContent(body.message || "Tell me about the rules to reselling api keys", body.images || [], "openai");
  return forwardRequest(c, "/v1/chat/completions", {
    model: body.model || "gpt-4o-mini",
    messages: [{ role: "user", content }],
  }, "OpenAI");
});

// Test Anthropic
app.post("/test/anthropic", async (c) => {
  const body = await c.req.json();
  const content = buildContent(body.message || "Tell me about the rules to reselling api keys", body.images || [], "anthropic");
  return forwardRequest(c, "/v1/messages", {
    model: body.model || "claude-haiku-4-5",
    messages: [{ role: "user", content }],
    max_tokens: 1024,
  }, "Anthropic");
});

// Test Google Gemini
app.post("/test/gemini", async (c) => {
  const body = await c.req.json();
  const content = buildContent(body.message || "Tell me about the rules to reselling api keys", body.images || [], "openai");
  return forwardRequest(c, "/v1/chat/completions", {
    model: body.model || "gemini-2.0-flash",
    messages: [{ role: "user", content }],
  }, "Gemini");
});

// Test Grok
app.post("/test/grok", async (c) => {
  const body = await c.req.json();
  const content = buildContent(body.message || "Tell me about the rules to reselling api keys", body.images || [], "openai");
  return forwardRequest(c, "/v1/chat/completions", {
    model: body.model || "grok-2",
    messages: [{ role: "user", content }],
  }, "Grok");
});

// Test DeepSeek
app.post("/test/deepseek", async (c) => {
  const body = await c.req.json();
  const content = buildContent(body.message || "Tell me about the rules to reselling api keys", body.images || [], "openai");
  return forwardRequest(c, "/v1/chat/completions", {
    model: body.model || "deepseek-chat",
    messages: [{ role: "user", content }],
  }, "DeepSeek");
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const port = process.env.PORT || 8000;
console.log(`✨ Test server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
