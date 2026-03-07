import { supabase } from "../supabase";

interface PricingRecord {
  inputRate: number;
  outputRate: number;
}

// Cache for pricing lookups
const pricingCache = new Map<string, PricingRecord>();

export async function getPricing(
  provider: string,
  model: string
): Promise<{ inputRate: number; outputRate: number } | null> {
  const cacheKey = `${provider}:${model}`;

  // Check cache
  if (pricingCache.has(cacheKey)) {
    return pricingCache.get(cacheKey)!;
  }

  try {
    const { data, error } = await supabase
      .from("provider_pricing")
      .select("input_per_1m, output_per_1m")
      .eq("provider", provider)
      .eq("model", model)
      .is("effective_to", null) // Get current pricing
      .single();

    if (error || !data) {
      console.warn(`No pricing found for ${provider}/${model}`);
      return null;
    }

    const pricing = {
      inputRate: Number(data.input_per_1m),
      outputRate: Number(data.output_per_1m),
    };

    pricingCache.set(cacheKey, pricing);
    return pricing;
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return null;
  }
}

export function calculateCosts(
  inputTokens: number,
  outputTokens: number,
  inputRate: number,
  outputRate: number
): {
  costUpstream: number;
  costCharged: number;
  sellerEarning: number;
  yourMargin: number;
} {
  const costUpstream = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  const costCharged = costUpstream * 0.5; // Buyer pays 50% of provider rate
  const sellerEarning = costCharged * 0.8; // Seller gets 80% of buyer price
  const yourMargin = costCharged * 0.2; // System gets 20% of buyer price

  return {
    costUpstream,
    costCharged,
    sellerEarning,
    yourMargin,
  };
}
