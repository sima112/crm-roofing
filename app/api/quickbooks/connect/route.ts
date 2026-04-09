import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUri, qboConfigured } from "@/lib/quickbooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!qboConfigured) {
    return NextResponse.json({ error: "QuickBooks not configured" }, { status: 503 });
  }

  // Require auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));

  // Get business ID for state
  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const bizData = biz as { id: string };

  // Generate CSRF state token: random hex + business_id
  const randomPart = crypto.getRandomValues(new Uint8Array(16));
  const randomHex  = Array.from(randomPart).map((b) => b.toString(16).padStart(2, "0")).join("");
  const state      = `${randomHex}.${bizData.id}`;

  // Store state in a short-lived httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set("qbo_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes
    path:     "/",
  });

  const authUri = getAuthUri(state);
  return NextResponse.redirect(authUri);
}
