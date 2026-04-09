import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { qboConfigured, makeApiCall } from "@/lib/quickbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!qboConfigured) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id, qbo_realm_id, qbo_sync_enabled, qbo_company_name")
    .eq("owner_id", user.id)
    .single();

  const bizData = biz as {
    id: string;
    qbo_realm_id: string | null;
    qbo_sync_enabled: boolean;
    qbo_company_name: string | null;
  } | null;

  if (!bizData?.qbo_sync_enabled || !bizData.qbo_realm_id) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  // Return cached name if available
  if (bizData.qbo_company_name) {
    return NextResponse.json({ companyName: bizData.qbo_company_name });
  }

  // Fetch from QBO
  try {
    const res = await makeApiCall(bizData.id, `companyinfo/${bizData.qbo_realm_id}`) as {
      CompanyInfo?: { CompanyName?: string };
    };
    const companyName = res.CompanyInfo?.CompanyName ?? "Your QuickBooks Company";

    await admin
      .from("businesses")
      .update({ qbo_company_name: companyName } as never)
      .eq("id", bizData.id);

    return NextResponse.json({ companyName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch company info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
