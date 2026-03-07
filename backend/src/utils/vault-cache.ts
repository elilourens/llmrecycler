import { supabase } from "../supabase";

interface CacheEntry {
  key: string;
  expiresAt: number;
}

const vaultCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function getVaultSecret(sellerKeyId: string): Promise<string | null> {
  // Check cache first
  const cached = vaultCache.get(sellerKeyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  // Fetch from vault via RPC (decryption happens inside Postgres)
  try {
    const { data: secret, error } = await supabase.rpc(
      "get_seller_key_secret",
      { p_seller_key_id: sellerKeyId }
    );

    if (error || !secret) {
      console.error("Error retrieving secret from vault:", error);
      return null;
    }

    // Cache the secret (keep TTL short so rotated keys take effect quickly)
    vaultCache.set(sellerKeyId, {
      key: secret,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return secret;
  } catch (error) {
    console.error("Unexpected error fetching vault secret:", error);
    return null;
  }
}

export function clearVaultCache(vaultSecretRef?: string): void {
  if (vaultSecretRef) {
    vaultCache.delete(vaultSecretRef);
  } else {
    vaultCache.clear();
  }
}
