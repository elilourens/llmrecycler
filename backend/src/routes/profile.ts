import { Hono } from "hono";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/auth";

const profileRouter = new Hono();

// Apply auth middleware to all routes
profileRouter.use(authMiddleware);

// GET /api/profile - fetch user's wallet info
profileRouter.get("/", async (c) => {
  const userId = c.get("userId");

  try {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance, total_spent, total_earned")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching wallet:", error);
      return c.json({ error: "Failed to fetch wallet" }, 500);
    }

    return c.json({
      balance: data?.balance || 0,
      totalSpent: data?.total_spent || 0,
      totalEarned: data?.total_earned || 0,
    });
  } catch (err) {
    console.error("Unexpected error fetching wallet:", err);
    return c.json({ error: "Failed to fetch wallet" }, 500);
  }
});

export default profileRouter;
