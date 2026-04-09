import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, qboConfigured } from "@/lib/quickbooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirect(path: string) {
  return NextResponse.redirect(new URL(path, APP_URL));
}

export async function GET(req: NextRequest) {
  if (!qboConfigured) return redirect("/settings?tab=quickbooks&error=not_configured");

  const { searchParams } = req.nextUrl;
  const code      = searchParams.get("code");
  const state     = searchParams.get("state");
  const realmId   = searchParams.get("realmId");
  const errorParam = searchParams.get("error");

  // User denied access on QBO side
  if (errorParam) return redirect("/settings?tab=quickbooks&error=access_denied");

  if (!code || !state || !realmId) {
    return redirect("/settings?tab=quickbooks&error=invalid_callback");
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState  = cookieStore.get("qbo_oauth_state")?.value;
  cookieStore.delete("qbo_oauth_state");

  if (!savedState || savedState !== state) {
    return redirect("/settings?tab=quickbooks&error=state_mismatch");
  }

  // Extract business_id from state (format: randomHex.businessId)
  const businessId = state.split(".").slice(1).join(".");
  if (!businessId) return redirect("/settings?tab=quickbooks&error=invalid_state");

  try {
    // Exchange code for tokens
    const { accessToken, refreshToken, expiresAt } = await exchangeCode(req.url);

    const admin = createAdminClient();
    const { error } = await admin
      .from("businesses")
      .update({
        qbo_realm_id:         realmId,
        qbo_access_token:     accessToken,
        qbo_refresh_token:    refreshToken,
        qbo_token_expires_at: expiresAt.toISOString(),
        qbo_connected_at:     new Date().toISOString(),
        qbo_sync_enabled:     true,
      })
      .eq("id", businessId);

    if (error) throw error;

    return redirect("/settings?tab=quickbooks&connected=true");
  } catch (err) {
    console.error("[QBO callback]", err);
    return redirect("/settings?tab=quickbooks&error=token_exchange_failed");
  }
}
