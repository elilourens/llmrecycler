import { Context, Next } from "hono";
import { supabase } from "../supabase";

export interface ProxyContext {
  buyerKeyId: string;
  buyerUserId: string;
  buyerBalance: number;
}

export const proxyAuthMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header("x-api-key");

  if (!apiKey) {
    return c.json({ error: { type: "authentication_error", message: "Missing x-api-key header" } }, 401);
  }

  try {
    // Verify buyer key via RPC (comparison happens in Postgres, secret never exposed)
    const { data: keyRecord, error: keyError } = await supabase.rpc(
      "verify_buyer_key_by_secret",
      { p_api_key: apiKey }
    );

    if (keyError || !keyRecord || keyRecord.length === 0) {
      return c.json(
        { error: { type: "authentication_error", message: "Invalid API key" } },
        401
      );
    }

    const keyData = Array.isArray(keyRecord) ? keyRecord[0] : keyRecord;

    // Verify key is active
    if (keyData.status !== "active") {
      return c.json(
        { error: { type: "authentication_error", message: "API key is not active" } },
        401
      );
    }

    // Fetch wallet to check balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", keyData.user_id)
      .single();

    if (walletError || !wallet) {
      return c.json({ error: { type: "internal_error", message: "Wallet not found" } }, 500);
    }

    // Check if buyer has sufficient balance
    if (wallet.balance <= 0) {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Insufficient balance",
          },
        },
        402
      );
    }

    // Attach context for downstream handlers
    c.set("proxyContext", {
      buyerKeyId: keyData.id,
      buyerUserId: keyData.user_id,
      buyerBalance: wallet.balance,
    } as ProxyContext);
  } catch (err) {
    console.error("Error in proxy auth middleware:", err);
    return c.json(
      { error: { type: "internal_error", message: "Authentication failed" } },
      500
    );
  }

  await next();
};
