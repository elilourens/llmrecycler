import { Hono } from "hono";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/auth";

const keysRouter = new Hono();

// Apply auth middleware to all routes
keysRouter.use(authMiddleware);

// GET /api/keys - fetch user's keys
keysRouter.get("/", async (c) => {
  const userId = c.get("userId");

  try {
    const { data, error } = await supabase
      .from("seller_keys")
      .select("id, provider, key_hint, status, created_at")
      .eq("user_id", userId)
      .neq("status", "hidden")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching keys:", error);
      return c.json({ error: "Failed to fetch keys" }, 500);
    }

    return c.json({ keys: data || [] });
  } catch (err) {
    console.error("Unexpected error fetching keys:", err);
    return c.json({ error: "Failed to fetch keys" }, 500);
  }
});

// POST /api/keys - add a new key
keysRouter.post("/", async (c) => {
  const userId = c.get("userId");

  try {
    const body = await c.req.json();
    const { key, provider } = body;

    // Validate input types
    if (typeof key !== "string" || typeof provider !== "string") {
      return c.json({ error: "Invalid request: key and provider must be strings" }, 400);
    }

    const trimmedKey = key.trim();
    const trimmedProvider = provider.trim();

    // Validate key length
    if (trimmedKey.length < 20 || trimmedKey.length > 200) {
      return c.json({ error: "Invalid key length: must be between 20 and 200 characters" }, 400);
    }

    // Validate key format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmedKey)) {
      return c.json({ error: "Invalid key format: only alphanumeric, hyphens, and underscores allowed" }, 400);
    }

    // Validate provider is not empty
    if (trimmedProvider.length === 0 || trimmedProvider.length > 100) {
      return c.json({ error: "Invalid provider: must be between 1 and 100 characters" }, 400);
    }

    // Generate key hint: first 10 chars + "..." + last 4 chars
    const keyHint = `${trimmedKey.substring(0, 10)}...${trimmedKey.substring(trimmedKey.length - 4)}`;

    // Call stored procedure to atomically store in vault + insert record
    const { data: keyId, error: rpcError } = await supabase.rpc("add_seller_key", {
      p_user_id: userId,
      p_api_key: trimmedKey,
      p_provider: trimmedProvider,
      p_key_hint: keyHint,
    });

    if (rpcError) {
      console.error("Error storing key:", rpcError);
      return c.json({ error: "Failed to store key in vault" }, 500);
    }

    // Fetch the created record
    const { data: record, error: fetchError } = await supabase
      .from("seller_keys")
      .select("id, provider, key_hint, status, created_at")
      .eq("id", keyId)
      .single();

    if (fetchError || !record) {
      console.error("Error fetching created key:", fetchError);
      return c.json({ error: "Key created but failed to fetch record" }, 500);
    }

    return c.json({ key: record }, 201);
  } catch (err) {
    console.error("Error adding key:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to add key: ${message}` }, 500);
  }
});

// DELETE /api/keys/:id - hide a seller key
keysRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id");

  try {
    // Validate UUID format (basic check)
    if (!keyId || keyId.length !== 36) {
      return c.json({ error: "Invalid key ID format" }, 400);
    }

    // Set status to 'hidden' instead of deleting
    const { error: updateError } = await supabase
      .from("seller_keys")
      .update({ status: "hidden" })
      .eq("id", keyId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error hiding seller key:", updateError);
      return c.json({ error: "Failed to hide seller key" }, 500);
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("Error hiding seller key:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to hide seller key: ${message}` }, 500);
  }
});

// PATCH /api/keys/:id - toggle seller key status between active and deactivated
keysRouter.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id");

  try {
    // Validate UUID format (basic check)
    if (!keyId || keyId.length !== 36) {
      return c.json({ error: "Invalid key ID format" }, 400);
    }

    const body = await c.req.json();
    const { status } = body;

    // Validate status is a valid value (only active or deactivated allowed for toggle)
    if (!status || !["active", "deactivated"].includes(status)) {
      return c.json({ error: "Invalid request: status must be 'active' or 'deactivated'" }, 400);
    }

    // Verify the key belongs to the user and update status
    const { error: updateError } = await supabase
      .from("seller_keys")
      .update({ status })
      .eq("id", keyId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating seller key status:", updateError);
      return c.json({ error: "Failed to update seller key status" }, 500);
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("Error updating seller key status:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to update seller key status: ${message}` }, 500);
  }
});

export default keysRouter;
