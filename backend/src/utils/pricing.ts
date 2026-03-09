import { supabase } from "../supabase";

interface PricingRecord {
  inputRate: number;
  outputRate: number;
  contextLengthThreshold?: number | null;
  overThresholdInputRate?: number | null;
  overThresholdOutputRate?: number | null;
}

// Cache for pricing lookups
const pricingCache = new Map<string, PricingRecord>();

export async function getPricing(
  provider: string,
  model: string,
  inputTokens: number = 0
): Promise<{ inputRate: number; outputRate: number } | null> {
  const cacheKey = `${provider}:${model}`;

  let pricing = pricingCache.get(cacheKey);

  // Fetch pricing for this provider:model if not cached
  if (!pricing) {
    try {
      const { data, error } = await supabase
        .from("provider_pricing")
        .select(
          "input_per_1m, output_per_1m, context_length_threshold, over_threshold_input_per_1m, over_threshold_output_per_1m"
        )
        .eq("provider", provider)
        .eq("model", model)
        .is("effective_to", null)
        .single();

      if (error || !data) {
        console.warn(`No pricing found for ${provider}/${model}`);
        return null;
      }

      pricing = {
        inputRate: Number(data.input_per_1m),
        outputRate: Number(data.output_per_1m),
        contextLengthThreshold: data.context_length_threshold,
        overThresholdInputRate: data.over_threshold_input_per_1m
          ? Number(data.over_threshold_input_per_1m)
          : null,
        overThresholdOutputRate: data.over_threshold_output_per_1m
          ? Number(data.over_threshold_output_per_1m)
          : null,
      };

      pricingCache.set(cacheKey, pricing);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      return null;
    }
  }

  // Determine which pricing tier to use
  const useOverThreshold =
    pricing.contextLengthThreshold &&
    inputTokens > pricing.contextLengthThreshold &&
    pricing.overThresholdInputRate &&
    pricing.overThresholdOutputRate;

  return {
    inputRate: useOverThreshold
      ? pricing.overThresholdInputRate!
      : pricing.inputRate,
    outputRate: useOverThreshold
      ? pricing.overThresholdOutputRate!
      : pricing.outputRate,
  };
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
