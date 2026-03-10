import { Hono } from "hono";
import { supabase } from "../supabase";

const pricingRouter = new Hono();

// GET /api/pricing - public endpoint, no auth required
pricingRouter.get("/", async (c) => {
  try {
    const { data, error } = await supabase
      .from("provider_pricing")
      .select("provider, model, input_per_1m, output_per_1m, context_length_threshold, over_threshold_input_per_1m, over_threshold_output_per_1m")
      .is("effective_to", null)
      .order("provider")
      .order("model");

    if (error) {
      console.error("Error fetching pricing:", error);
      return c.json({ error: "Failed to fetch pricing" }, 500);
    }

    const pricing = (data || []).map((row) => {
      const inputUpstream = Number(row.input_per_1m);
      const outputUpstream = Number(row.output_per_1m);
      // Buyer pays 50% of provider rate
      const inputBuyer = inputUpstream * 0.5;
      const outputBuyer = outputUpstream * 0.5;
      // Seller earns 80% of buyer price
      const inputSeller = inputBuyer * 0.8;
      const outputSeller = outputBuyer * 0.8;

      return {
        provider: row.provider,
        model: row.model,
        inputUpstream,
        outputUpstream,
        inputBuyer,
        outputBuyer,
        inputSeller,
        outputSeller,
        contextLengthThreshold: row.context_length_threshold ?? null,
        overThresholdInputBuyer: row.over_threshold_input_per_1m
          ? Number(row.over_threshold_input_per_1m) * 0.5
          : null,
        overThresholdOutputBuyer: row.over_threshold_output_per_1m
          ? Number(row.over_threshold_output_per_1m) * 0.5
          : null,
      };
    });

    return c.json({ pricing });
  } catch (err) {
    console.error("Unexpected error fetching pricing:", err);
    return c.json({ error: "Failed to fetch pricing" }, 500);
  }
});

export default pricingRouter;
