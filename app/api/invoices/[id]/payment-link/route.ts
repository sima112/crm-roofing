import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/invoices/[id]/payment-link
 * Creates (or re-uses) a Stripe Payment Link for the invoice and stores it.
 * Called server-side when "Mark as Sent" is triggered.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch invoice + business
  const [{ data: invoice }, { data: business }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, total, customer_id, business_id, stripe_payment_link, customers(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!invoice || !business) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Return existing link if already created
  if (invoice.stripe_payment_link) {
    return NextResponse.json({ url: invoice.stripe_payment_link });
  }

  const stripe = getStripe();
  const totalCents = Math.round(Number(invoice.total) * 100);
  const customerName = (invoice.customers as unknown as { name: string } | null)?.name ?? "Customer";

  try {
    // 1. Create a one-time Price
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: totalCents,
      product_data: {
        name: `Invoice ${invoice.invoice_number} — ${business.name}`,
        metadata: { invoice_id: id },
      },
    });

    // 2. Create a Payment Link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        invoice_id: id,
        business_id: business.id,
        customer_id: invoice.customer_id,
      },
      after_completion: {
        type: "redirect",
        redirect: { url: `${appUrl}/payment-success` },
      },
      payment_intent_data: {
        metadata: {
          invoice_id: id,
          business_id: business.id,
        },
      },
    });

    // 3. Store the link on the invoice
    const admin = createAdminClient();
    await admin
      .from("invoices")
      .update({ stripe_payment_link: paymentLink.url } as never)
      .eq("id", id);

    return NextResponse.json({ url: paymentLink.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    console.error("[payment-link] Stripe error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
