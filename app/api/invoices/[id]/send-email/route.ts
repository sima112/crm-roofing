import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, resendConfigured } from "@/lib/resend";
import { buildInvoiceEmail } from "@/lib/invoice-email";
import { transitionInvoice } from "@/lib/invoice-transition";
import { withPermission } from "@/middleware/withPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withPermission("invoices:send")(
  async (req: NextRequest, ctx: Ctx) => {
    const { id } = await ctx.params;
    const { user, business } = ctx as Ctx & { user: { id: string; email: string }; business: { id: string } };

    if (!resendConfigured) {
      return NextResponse.json({ error: "Email not configured — add RESEND_API_KEY to .env.local" }, { status: 400 });
    }

    const admin = createAdminClient();

    const [{ data: invoice }, { data: biz }] = await Promise.all([
      admin
        .from("invoices")
        .select(`
          id, invoice_number, status, amount, tax_rate, tax_amount, total,
          due_date, created_at, line_items, stripe_payment_link,
          customers(name, email)
        `)
        .eq("id", id)
        .eq("business_id", business.id)
        .maybeSingle(),
      admin
        .from("businesses")
        .select("name, phone, email, address")
        .eq("id", business.id)
        .maybeSingle(),
    ]);

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (!biz)     return NextResponse.json({ error: "Business not found" }, { status: 404 });

    type Customer = { name: string; email: string | null };
    const customer = invoice.customers as unknown as Customer | null;

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer has no email address on file" }, { status: 400 });
    }

    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const trackingUrl = `${appUrl}/api/invoices/${id}/track`;
    const pdfLink     = `${appUrl}/api/invoices/${id}/pdf`;

    type LI = { description: string; quantity: number; unit_price: number; amount: number };
    const { subject, html } = buildInvoiceEmail({
      invoiceId:       id,
      invoiceNumber:   invoice.invoice_number,
      customerName:    customer.name,
      businessName:    (biz as { name: string }).name,
      businessPhone:   (biz as { phone: string | null }).phone,
      businessEmail:   (biz as { email: string | null }).email,
      businessAddress: (biz as { address: string | null }).address,
      total:           Number(invoice.total),
      amount:          Number(invoice.amount),
      taxAmount:       Number(invoice.tax_amount),
      taxRate:         Number(invoice.tax_rate),
      dueDate:         invoice.due_date,
      createdAt:       invoice.created_at,
      paymentLink:     invoice.stripe_payment_link,
      pdfLink,
      trackingUrl,
      lineItems: (Array.isArray(invoice.line_items) ? invoice.line_items : []) as LI[],
    });

    const resend      = getResend();
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "invoices@crewbooks.app";

    const { error: sendError } = await resend.emails.send({
      from:    `${(biz as { name: string }).name} via CrewBooks <${fromAddress}>`,
      to:      customer.email,
      subject,
      html,
    });

    if (sendError) {
      console.error("[send-email] Resend error:", sendError);
      return NextResponse.json({ error: "Failed to send email: " + (sendError as { message?: string }).message }, { status: 500 });
    }

    if (invoice.status === "draft") {
      await transitionInvoice(id, "sent", {
        sentVia:   "email",
        changedBy: user.email ?? user.id,
        note:      "Sent via email",
      });
    } else {
      await admin
        .from("invoices")
        .update({ sent_at: new Date().toISOString(), sent_via: "email" } as never)
        .eq("id", id);
    }

    return NextResponse.json({ success: true });
  }
);
