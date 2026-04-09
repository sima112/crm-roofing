"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type InvoiceFormState = { error: string | null; success: boolean; id?: string };

// ── Create invoice ────────────────────────────────────────────────────────────

export async function createInvoiceAction(
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { error: "Business not found", success: false };

  const customer_id = formData.get("customer_id") as string;
  if (!customer_id) return { error: "Customer is required", success: false };

  const lineItemsRaw = formData.get("line_items") as string;
  const line_items: LineItem[] = lineItemsRaw ? JSON.parse(lineItemsRaw) : [];
  const amount = line_items.reduce((s, li) => s + li.amount, 0);

  const sendNow = formData.get("send_now") === "true";
  const status = sendNow ? "sent" : "draft";

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      business_id: business.id,
      customer_id,
      job_id: (formData.get("job_id") as string) || null,
      invoice_number: "", // trigger auto-generates
      amount,
      tax_rate: 0.0825,
      status,
      due_date: (formData.get("due_date") as string) || null,
      notes: (formData.get("notes") as string) || null,
      line_items,
    } as never)
    .select("id")
    .single();

  if (error) return { error: error.message, success: false };

  revalidatePath("/invoices");
  redirect(`/invoices/${data.id}`);
}

// ── Update invoice ────────────────────────────────────────────────────────────

export async function updateInvoiceAction(
  id: string,
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const supabase = await createClient();

  const lineItemsRaw = formData.get("line_items") as string;
  const line_items: LineItem[] = lineItemsRaw ? JSON.parse(lineItemsRaw) : [];
  const amount = line_items.reduce((s, li) => s + li.amount, 0);

  const sendNow = formData.get("send_now") === "true";

  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id: formData.get("customer_id") as string,
      job_id: (formData.get("job_id") as string) || null,
      amount,
      tax_rate: 0.0825,
      status: sendNow ? "sent" : "draft",
      due_date: (formData.get("due_date") as string) || null,
      notes: (formData.get("notes") as string) || null,
      line_items,
    } as never)
    .eq("id", id);

  if (error) return { error: error.message, success: false };

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

// ── Change status ─────────────────────────────────────────────────────────────

export async function changeInvoiceStatusAction(
  id: string,
  status: string
): Promise<{ error: string | null; paymentLink?: string }> {
  const supabase = await createClient();
  const fields: Record<string, unknown> = { status };
  if (status === "paid") fields.paid_date = new Date().toISOString();

  const { error } = await supabase
    .from("invoices")
    .update(fields as never)
    .eq("id", id);

  if (error) return { error: error.message };

  // Auto-create Stripe payment link when marking as sent
  let paymentLink: string | undefined;
  if (status === "sent") {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const res = await fetch(`${appUrl}/api/invoices/${id}/payment-link`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json() as { url?: string };
        paymentLink = json.url;
      }
    } catch {
      // Non-fatal — Stripe may not be configured
    }

    // Schedule payment reminder 7 days from now (if still unpaid)
    await schedulePaymentReminder(supabase, id, paymentLink);
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { error: null, paymentLink };
}

// ── Send invoice via SMS ───────────────────────────────────────────────────────

export async function sendInvoiceSMSAction(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: invoice }, { data: business }] = await Promise.all([
    supabase
      .from("invoices")
      .select("stripe_payment_link, total, customers(name, phone)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!invoice || !business) return { error: "Invoice not found" };

  const customer = invoice.customers as unknown as { name: string; phone: string | null } | null;
  if (!customer?.phone) return { error: "Customer has no phone number on file" };
  if (!invoice.stripe_payment_link) return { error: "No payment link yet — mark invoice as Sent first" };

  const total = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(invoice.total));

  const body =
    `Hi ${customer.name}, here's your invoice from ${business.name} for ${total}. ` +
    `Pay securely online: ${invoice.stripe_payment_link}`;

  return sendSMS({ to: customer.phone, body });
}

// ── Payment reminder helper (private) ─────────────────────────────────────────

async function schedulePaymentReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  paymentLink: string | undefined
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, reminder_settings")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return;

  const settings = (business as { reminder_settings: unknown }).reminder_settings as {
    payment_reminder?: { enabled: boolean; days_after: number; template: string };
  } | null;

  const cfg = settings?.payment_reminder ?? {
    enabled: true,
    days_after: 7,
    template:
      "Hi {{customer_name}}, friendly reminder that invoice {{invoice_number}} for {{total}} from {{business_name}} is due. Pay online: {{payment_link}}",
  };
  if (!cfg.enabled) return;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("invoice_number, total, customer_id, customers(name, phone)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;

  const customer = invoice.customers as unknown as { name: string; phone: string | null } | null;
  if (!customer?.phone) return;

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + cfg.days_after);

  const total = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(invoice.total));

  const message = cfg.template
    .replace(/\{\{customer_name\}\}/g, customer.name)
    .replace(/\{\{business_name\}\}/g, (business as { name: string }).name)
    .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number as string)
    .replace(/\{\{total\}\}/g, total)
    .replace(/\{\{payment_link\}\}/g, paymentLink ?? "");

  const admin = createAdminClient();
  await admin.from("reminders").insert({
    business_id: (business as { id: string }).id,
    invoice_id: invoiceId,
    customer_id: invoice.customer_id,
    type: "payment_reminder",
    message,
    phone: customer.phone,
    scheduled_for: scheduledAt.toISOString(),
    status: "pending",
  } as never);
}

// ── Delete invoice ────────────────────────────────────────────────────────────

export async function deleteInvoiceAction(
  id: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const { error } = await admin.from("invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/invoices");
  return { error: null };
}
