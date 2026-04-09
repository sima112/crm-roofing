import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Returns the status of all external services.
 * Used for uptime monitoring and post-deploy verification.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  // ── Supabase ────────────────────────────────────────────────────────────────
  let supabase: "connected" | "disconnected" = "disconnected";
  try {
    const admin = createAdminClient();
    // Lightweight ping — count rows in a small table
    const { error } = await admin.from("businesses").select("id", { count: "exact", head: true });
    if (!error) supabase = "connected";
  } catch {
    // stays "disconnected"
  }

  // ── Stripe ──────────────────────────────────────────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe: "configured" | "not-configured" =
    stripeKey && stripeKey !== "sk_test_..." ? "configured" : "not-configured";

  // ── Twilio ──────────────────────────────────────────────────────────────────
  const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const twilio: "configured" | "not-configured" =
    twilioSid   && twilioSid   !== "your-sid"      &&
    twilioToken && twilioToken !== "your-token"     &&
    twilioPhone && twilioPhone !== "+1xxxxxxxxxx"
      ? "configured"
      : "not-configured";

  const allOk = supabase === "connected";

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp,
      services: { supabase, stripe, twilio },
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    },
    { status: allOk ? 200 : 503 }
  );
}
