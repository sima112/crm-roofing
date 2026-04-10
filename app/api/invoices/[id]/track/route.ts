import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionInvoice } from "@/lib/invoice-transition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/[id]/track
 * Called when a customer clicks the payment link.
 * Logs the view, upgrades status to "viewed" if currently "sent", then redirects.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin   = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status, viewed_at, viewed_count, stripe_payment_link")
    .eq("id", id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inv = invoice as {
    id: string;
    status: string;
    viewed_at: string | null;
    viewed_count: number;
    stripe_payment_link: string | null;
  };

  // Increment view count, set viewed_at on first view
  const updates: Record<string, unknown> = {
    viewed_count: (inv.viewed_count ?? 0) + 1,
  };
  if (!inv.viewed_at) {
    updates.viewed_at = new Date().toISOString();
  }

  await admin.from("invoices").update(updates as never).eq("id", id);

  // Transition to "viewed" if currently "sent"
  if (inv.status === "sent") {
    await transitionInvoice(id, "viewed", { note: "Customer opened payment link" });
  }

  // Redirect to the actual Stripe payment link
  if (inv.stripe_payment_link) {
    return NextResponse.redirect(inv.stripe_payment_link);
  }

  return NextResponse.json({ error: "No payment link" }, { status: 404 });
}
