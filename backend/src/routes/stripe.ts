import { Hono } from "hono";
import { supabase } from "../supabase";
import { authMiddleware } from "../middleware/auth";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const stripeRouter = new Hono();

// POST /api/stripe/checkout - Create checkout session (authenticated)
stripeRouter.post("/checkout", authMiddleware, async (c) => {
  const userId = c.get("userId");

  try {
    const body = await c.req.json();
    const { amount } = body as { amount: number };

    if (!amount || amount <= 0) {
      return c.json({ error: "Invalid amount" }, 400);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Wallet Top-up: $${amount}`,
              description: "Add funds to your API Recycler wallet",
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/dashboard?topup=success`,
      cancel_url: `${frontendUrl}/dashboard`,
      metadata: {
        user_id: userId,
        amount: amount.toString(),
      },
    });

    return c.json({ url: session.url });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// POST /api/stripe/webhook - Handle Stripe events
stripeRouter.post("/webhook", async (c) => {
  try {
    const signature = c.req.header("stripe-signature");
    if (!signature) {
      return c.json({ error: "Missing stripe-signature header" }, 400);
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Verify and construct event
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id;
      const amount = parseFloat(session.metadata?.amount || "0");

      if (!userId || !amount) {
        console.error("Missing user_id or amount in session metadata");
        return c.json({ error: "Invalid session metadata" }, 400);
      }

      // Update wallet balance
      const { data: wallet, error: fetchError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (fetchError || !wallet) {
        console.error("Error fetching wallet:", fetchError);
        return c.json({ error: "Wallet not found" }, 404);
      }

      const newBalance = wallet.balance + amount;

      // Update wallet
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating wallet:", updateError);
        return c.json({ error: "Failed to update wallet" }, 500);
      }

      // Insert transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "topup",
          amount: amount,
          balance_after: newBalance,
          stripe_id: session.payment_intent,
          created_at: new Date().toISOString(),
        });

      if (transactionError) {
        console.error("Error creating transaction:", transactionError);
        return c.json({ error: "Failed to create transaction" }, 500);
      }

      console.log(`✅ Topup successful: user ${userId} +$${amount}`);
    }

    return c.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    if (err instanceof Error && err.message.includes("No matching key found")) {
      return c.json({ error: "Invalid signature" }, 401);
    }
    return c.json({ error: "Webhook error" }, 500);
  }
});

// POST /api/stripe/withdraw - Request withdrawal (authenticated)
stripeRouter.post("/withdraw", authMiddleware, async (c) => {
  const userId = c.get("userId");

  try {
    const body = await c.req.json();
    const { amount, paypalEmail } = body as {
      amount: number;
      paypalEmail: string;
    };

    // Validate minimum $1
    if (!amount || amount < 1) {
      return c.json({ error: "Minimum withdrawal is $1" }, 400);
    }

    if (!paypalEmail) {
      return c.json({ error: "PayPal email is required" }, 400);
    }

    // Basic email validation
    if (!paypalEmail.includes("@")) {
      return c.json({ error: "Invalid PayPal email" }, 400);
    }

    // Fetch wallet
    const { data: wallet, error: fetchError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (fetchError || !wallet) {
      console.error("Error fetching wallet:", fetchError);
      return c.json({ error: "Wallet not found" }, 404);
    }

    // Validate sufficient balance
    if (wallet.balance < amount) {
      return c.json({ error: "Insufficient balance" }, 400);
    }

    // Create payout request (pending approval)
    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .insert({
        user_id: userId,
        amount: amount,
        status: "pending",
        paypal_email: paypalEmail,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (payoutError) {
      console.error("Error creating payout:", payoutError);
      return c.json({ error: "Failed to create payout request" }, 500);
    }

    // Deduct from balance immediately
    const newBalance = wallet.balance - amount;
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating wallet:", updateError);
      return c.json({ error: "Failed to update wallet" }, 500);
    }

    // Log transaction
    await supabase.from("transactions").insert({
      user_id: userId,
      type: "payout",
      amount: -amount,
      balance_after: newBalance,
      created_at: new Date().toISOString(),
    });

    console.log(`✅ Withdrawal requested: user ${userId} -$${amount} to ${paypalEmail}`);
    return c.json({
      message: "Withdrawal request submitted. Pending approval.",
      payout_id: payout.id,
    });
  } catch (err) {
    console.error("Error requesting withdrawal:", err);
    return c.json({ error: "Failed to request withdrawal" }, 500);
  }
});

export default stripeRouter;
