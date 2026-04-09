import Stripe from "stripe";

// NOTE: Uses STRIPE_SECRET_KEY from .env.local (sk_test_... for test mode)
// Switch to live keys (sk_live_...) in production .env

/** Returns a Stripe client. Call inside request handlers, never at module level. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY — add it to .env.local");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
}

/** True when Stripe keys are configured. Use to gate UI elements. */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY !== "sk_test_..."
  );
}
