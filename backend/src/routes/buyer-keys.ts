import { Hono } from "hono";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/auth";
import { randomBytes } from "crypto";

const buyerKeysRouter = new Hono();

// Apply auth middleware to all routes
buyerKeysRouter.use(authMiddleware);

// GET /api/buyer-keys - fetch user's buyer keys
buyerKeysRouter.get("/", async (c) => {
  const userId = c.get("userId");

  try {
    const { data, error } = await supabase
      .from("buyer_keys")
      .select("id, name, key_hint, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching buyer keys:", error);
      return c.json({ error: "Failed to fetch buyer keys" }, 500);
    }

    return c.json({ keys: data || [] });
  } catch (err) {
    console.error("Unexpected error fetching buyer keys:", err);
    return c.json({ error: "Failed to fetch buyer keys" }, 500);
  }
});

// POST /api/buyer-keys - generate a new buyer key
buyerKeysRouter.post("/", async (c) => {
  const userId = c.get("userId");

  try {
    const body = await c.req.json();
    const { name } = body;

    // Validate name if provided
    let keyName = "Default";
    if (name !== undefined) {
      if (typeof name !== "string") {
        return c.json({ error: "Invalid request: name must be a string" }, 400);
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        return c.json({ error: "Invalid name: must be between 1 and 100 characters" }, 400);
      }
      keyName = trimmedName;
    }

    // Generate cryptographically secure random key
    // 32 bytes of random data = 64 hex characters + "lmr_" prefix = 68 chars total
    const randomPart = randomBytes(32).toString("hex");
    const apiKey = `lmr_${randomPart}`;

    // Generate key hint: first 6 chars + "..." + last 4 chars
    // Format: lmr_abcd12...ef78
    const keyHint = `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`;

    // Call stored procedure to atomically store in vault + insert record
    const { data: keyId, error: rpcError } = await supabase.rpc("add_buyer_key", {
      p_user_id: userId,
      p_api_key: apiKey,
      p_name: keyName,
      p_key_hint: keyHint,
    });

    if (rpcError) {
      console.error("Error storing buyer key:", rpcError);
      return c.json({ error: "Failed to store buyer key in vault" }, 500);
    }

    // Fetch the created record
    const { data: record, error: fetchError } = await supabase
      .from("buyer_keys")
      .select("id, name, key_hint, is_active, created_at")
      .eq("id", keyId)
      .single();

    if (fetchError || !record) {
      console.error("Error fetching created buyer key:", fetchError);
      return c.json({ error: "Buyer key created but failed to fetch record" }, 500);
    }

    // Return both the record and the raw key (raw key only in this response)
    return c.json({ key: record, rawKey: apiKey }, 201);
  } catch (err) {
    console.error("Error generating buyer key:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to generate buyer key: ${message}` }, 500);
  }
});

// DELETE /api/buyer-keys/:id - revoke a buyer key
buyerKeysRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id");

  try {
    // Validate UUID format (basic check)
    if (!keyId || keyId.length !== 36) {
      return c.json({ error: "Invalid key ID format" }, 400);
    }

    // Call stored procedure to revoke the key
    const { error: rpcError } = await supabase.rpc("revoke_buyer_key", {
      p_key_id: keyId,
      p_user_id: userId,
    });

    if (rpcError) {
      console.error("Error revoking buyer key:", rpcError);
      return c.json({ error: "Failed to revoke buyer key" }, 500);
    }

    return c.json({ success: true }, 204);
  } catch (err) {
    console.error("Error revoking buyer key:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to revoke buyer key: ${message}` }, 500);
  }
});

export default buyerKeysRouter;
