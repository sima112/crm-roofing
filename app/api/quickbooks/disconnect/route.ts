import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeTokens, qboConfigured } from "@/lib/quickbooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!qboConfigured) {
    return NextResponse.json({ error: "QuickBooks not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const bizData = biz as { id: string };

  try {
    await revokeTokens(bizData.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[QBO disconnect]", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
