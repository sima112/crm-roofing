import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { qboConfigured, getValidAccessToken } from "@/lib/quickbooks";
import {
  syncCustomerToQBO,
  syncInvoiceToQBO,
  fullSync,
  pullCustomersFromQBO,
} from "@/lib/quickbooks-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getBusinessId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * POST /api/quickbooks/sync
 * Body: { type: "customer" | "invoice" | "full", id?: string }
 */
export async function POST(req: NextRequest) {
  try {
    if (!qboConfigured) {
      return NextResponse.json({ error: "QuickBooks not configured" }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const businessId = await getBusinessId(user.id);
    if (!businessId) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    // Verify QBO is actually connected before attempting sync
    const tokens = await getValidAccessToken(businessId);
    if (!tokens) {
      return NextResponse.json(
        { error: "QuickBooks is not connected. Go to Settings → QuickBooks and click Connect." },
        { status: 400 }
      );
    }

    let body: { type: string; id?: string };
    try {
      body = await req.json() as { type: string; id?: string };
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (body.type === "customer") {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const result = await syncCustomerToQBO(businessId, body.id);
      return NextResponse.json(result, { status: result.error ? 500 : 200 });
    }

    if (body.type === "invoice") {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const result = await syncInvoiceToQBO(businessId, body.id);
      return NextResponse.json(result, { status: result.error ? 500 : 200 });
    }

    if (body.type === "full") {
      const result = await fullSync(businessId);
      return NextResponse.json(result);
    }

    if (body.type === "pull_customers") {
      const result = await pullCustomersFromQBO(businessId);
      return NextResponse.json({ customers_pulled: result.created + result.updated, error: result.error });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    console.error("[QBO sync]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
