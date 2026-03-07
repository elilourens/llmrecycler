import { Hono } from "hono";
import { cors } from "hono/cors";
import { supabase } from "./supabase";
import keysRouter from "./routes/keys";
import buyerKeysRouter from "./routes/buyer-keys";
import proxyRouter from "./routes/proxy";
import profileRouter from "./routes/profile";

const app = new Hono();

// CORS middleware for frontend communication
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    credentials: true,
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// API routes
app.route("/api/keys", keysRouter);
app.route("/api/buyer-keys", buyerKeysRouter);
app.route("/api/proxy", proxyRouter);
app.route("/api/profile", profileRouter);

// Example API route
app.get("/api/test", (c) => {
  return c.json({ message: "Hello from Hono backend!" });
});

// Test Supabase connection
app.get("/api/db/test", async (c) => {
  try {
    // Try to get current user info - this tests authentication
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      // If auth endpoint fails, try a simple database query
      const { data: dbData, error: dbError } = await supabase
        .from("auth.users")
        .select("count(*)")
        .limit(1);

      if (dbError) throw new Error(`Auth test failed: ${dbError.message}`);
      return c.json({ status: "connected", message: "Database accessible via auth.users" });
    }

    return c.json({
      status: "connected",
      message: "Supabase authentication working",
      userCount: authData?.users?.length || 0,
      users: authData?.users?.map((u: any) => ({ id: u.id, email: u.email })) || []
    });
  } catch (error) {
    return c.json(
      {
        status: "connection_failed",
        error: error instanceof Error ? error.message : "Unknown error",
        hint: "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
      },
      500
    );
  }
});

const port = process.env.PORT || 3001;

export default {
  port,
  fetch: app.fetch,
};
