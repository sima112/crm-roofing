import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { qboConfigured, getValidAccessToken } from "@/lib/quickbooks";
import { syncInvoiceToQBO, syncCustomerToQBO } from "@/lib/quickbooks-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!qboConfigured) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  const bizData = biz as { id: string } | null;
  if (!bizData) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const tokens = await getValidAccessToken(bizData.id);
  if (!tokens) return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });

  // Retry failed invoices
  const { data: failedInvoices } = await admin
    .from("invoices")
    .select("id")
    .eq("business_id", bizData.id)
    .eq("qbo_sync_status", "error");

  // Retry failed customers (those with no qbo_customer_id from a failed push)
  // We track this via sync_log errors
  const { data: failedLogs } = await admin
    .from("sync_log")
    .select("entity_id, entity_type")
    .eq("business_id", bizData.id)
    .eq("status", "error")
    .eq("direction", "push")
    .order("created_at", { ascending: false })
    .limit(50);

  let retried = 0;
  const errors: string[] = [];

  for (const inv of failedInvoices ?? []) {
    const { error } = await syncInvoiceToQBO(bizData.id, (inv as { id: string }).id);
    if (error) errors.push(error); else retried++;
  }

  const customerIds = new Set(
    (failedLogs ?? [])
      .filter((l) => (l as { entity_type: string }).entity_type === "customer" && (l as { entity_id: string | null }).entity_id)
      .map((l) => (l as { entity_id: string }).entity_id)
  );

  for (const customerId of customerIds) {
    const { error } = await syncCustomerToQBO(bizData.id, customerId);
    if (error) errors.push(error); else retried++;
  }

  return NextResponse.json({ retried, errors });
}
