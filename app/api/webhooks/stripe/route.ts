import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionInvoice } from "@/lib/invoice-transition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "whsec_...") {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig ?? "", webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Use service-role admin client — webhooks have no user session
  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session   = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        // Also store the stripe_invoice_id
        await supabase
          .from("invoices")
          .update({ stripe_invoice_id: (session.payment_intent as string) ?? null } as never)
          .eq("id", invoiceId);

        const { error } = await transitionInvoice(invoiceId, "paid", {
          note:             "Payment confirmed via Stripe",
          paymentMethod:    "stripe",
          paymentReference: session.payment_intent as string ?? undefined,
          changedBy:        "stripe",
        });
        if (error) console.error("[stripe webhook] Failed to mark invoice paid:", error);
        else console.log(`[stripe webhook] Invoice ${invoiceId} marked as paid`);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi        = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        await supabase
          .from("invoices")
          .update({ stripe_invoice_id: pi.id } as never)
          .eq("id", invoiceId);
        await transitionInvoice(invoiceId, "paid", {
          note:             "Payment confirmed via Stripe",
          paymentMethod:    "stripe",
          paymentReference: pi.id,
          changedBy:        "stripe",
        });
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      console.warn(
        `[stripe webhook] Payment failed — invoice: ${invoiceId ?? "unknown"}, ` +
        `reason: ${pi.last_payment_error?.message ?? "unknown"}`
      );
      // Do not change status — customer can retry via the same payment link
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
