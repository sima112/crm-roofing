"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms";
import { qboConfigured } from "@/lib/quickbooks";
import { syncInvoiceToQBO } from "@/lib/quickbooks-sync";
import { transitionInvoice } from "@/lib/invoice-transition";

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

  const sendNow        = formData.get("send_now") === "true";
  const status         = sendNow ? "sent" : "draft";
  const depositRequired = formData.get("deposit_required") === "true";
  const depositAmount  = parseFloat(formData.get("deposit_amount") as string) || 0;
  const recurring      = formData.get("recurring") === "true";
  const recurringInterval = (formData.get("recurring_interval") as string) || "monthly";
  const recurringEndDate  = (formData.get("recurring_end_date") as string) || null;

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      business_id:       business.id,
      customer_id,
      job_id:            (formData.get("job_id") as string) || null,
      invoice_number:    "", // trigger auto-generates
      amount,
      tax_rate:          0.0825,
      status,
      due_date:          (formData.get("due_date") as string) || null,
      notes:             (formData.get("notes") as string) || null,
      line_items,
      deposit_required:  depositRequired,
      deposit_amount:    depositRequired ? depositAmount : null,
      recurring,
      recurring_interval: recurring ? recurringInterval : null,
      recurring_end_date: recurring && recurringEndDate ? recurringEndDate : null,
    } as never)
    .select("id")
    .single();

  if (error) return { error: error.message, success: false };

  // Auto-sync to QBO if connected and status is sent
  if (qboConfigured && status === "sent") {
    const bizData = business as { id: string; qbo_sync_enabled?: boolean };
    const { data: biz } = await supabase
      .from("businesses")
      .select("qbo_sync_enabled")
      .eq("id", (bizData).id)
      .maybeSingle();
    if ((biz as { qbo_sync_enabled?: boolean } | null)?.qbo_sync_enabled) {
      syncInvoiceToQBO((bizData).id, data.id).catch(() => {}); // non-blocking
    }
  }

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

  const sendNow        = formData.get("send_now") === "true";
  const depositRequired = formData.get("deposit_required") === "true";
  const depositAmount  = parseFloat(formData.get("deposit_amount") as string) || 0;
  const recurring      = formData.get("recurring") === "true";
  const recurringInterval = (formData.get("recurring_interval") as string) || "monthly";
  const recurringEndDate  = (formData.get("recurring_end_date") as string) || null;

  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id:       formData.get("customer_id") as string,
      job_id:            (formData.get("job_id") as string) || null,
      amount,
      tax_rate:          0.0825,
      status:            sendNow ? "sent" : "draft",
      due_date:          (formData.get("due_date") as string) || null,
      notes:             (formData.get("notes") as string) || null,
      line_items,
      deposit_required:  depositRequired,
      deposit_amount:    depositRequired ? depositAmount : null,
      recurring,
      recurring_interval: recurring ? recurringInterval : null,
      recurring_end_date: recurring && recurringEndDate ? recurringEndDate : null,
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
  status: string,
  opts?: { note?: string; paymentMethod?: string; paymentReference?: string; partialAmount?: number; disputeReason?: string }
): Promise<{ error: string | null; paymentLink?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Use state machine transition
  const { error } = await transitionInvoice(id, status as never, {
    note:             opts?.note,
    changedBy:        user?.email ?? user?.id ?? "user",
    paymentMethod:    opts?.paymentMethod,
    paymentReference: opts?.paymentReference,
    partialAmount:    opts?.partialAmount,
    disputeReason:    opts?.disputeReason,
    sentVia:          status === "sent" ? "link" : undefined,
  });

  if (error) return { error };

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

  // Auto-sync to QBO when marked as sent
  if (qboConfigured && (status === "sent" || status === "paid")) {
    try {
      const admin2 = createAdminClient();
      const { data: biz } = await admin2
        .from("invoices")
        .select("business_id, businesses(qbo_sync_enabled)")
        .eq("id", id)
        .maybeSingle();
      const bizData = biz as { business_id: string; businesses: { qbo_sync_enabled: boolean } | null } | null;
      if (bizData?.businesses?.qbo_sync_enabled) {
        syncInvoiceToQBO(bizData.business_id, id).catch(() => {}); // non-blocking
      }
    } catch {
      // Non-fatal
    }
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

// ── Waive late fee ────────────────────────────────────────────────────────────

export async function waiveLateFeeAction(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Fetch current line items to remove the late fee entry
  const { data: inv } = await admin
    .from("invoices")
    .select("line_items, amount, tax_rate")
    .eq("id", id)
    .single();

  if (!inv) return { error: "Invoice not found" };

  type LI = { description: string; quantity: number; unit_price: number; amount: number };
  const lineItems = (Array.isArray(inv.line_items) ? inv.line_items : []) as LI[];
  const filtered = lineItems.filter((li) => !li.description.startsWith("Late fee"));
  const newAmount = filtered.reduce((s, li) => s + li.amount, 0);

  const { error } = await admin
    .from("invoices")
    .update({
      late_fee_amount:     0,
      late_fee_applied_at: null,
      line_items:          filtered,
      amount:              newAmount,
    } as never)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { error: null };
}

// ── Cancel recurring ──────────────────────────────────────────────────────────

export async function cancelRecurringAction(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ recurring: false, recurring_next_date: null } as never)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { error: null };
}

// ── Send invoice email ────────────────────────────────────────────────────────

export async function sendInvoiceEmailAction(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { resendConfigured, getResend } = await import("@/lib/resend");
  if (!resendConfigured) {
    return { error: "Email not configured — add RESEND_API_KEY to .env.local" };
  }

  const { buildInvoiceEmail } = await import("@/lib/invoice-email");
  const admin = createAdminClient();

  const [{ data: invoice }, { data: business }] = await Promise.all([
    admin
      .from("invoices")
      .select(`
        id, invoice_number, status, amount, tax_rate, tax_amount, total,
        due_date, created_at, line_items, stripe_payment_link,
        customers(name, email)
      `)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name, phone, email, address")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!invoice) return { error: "Invoice not found" };
  if (!business) return { error: "Business not found" };

  type Customer = { name: string; email: string | null };
  const customer = invoice.customers as unknown as Customer | null;
  if (!customer?.email) return { error: "Customer has no email address on file" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  type LI = { description: string; quantity: number; unit_price: number; amount: number };

  const { subject, html } = buildInvoiceEmail({
    invoiceId:       id,
    invoiceNumber:   invoice.invoice_number,
    customerName:    customer.name,
    businessName:    (business as { name: string }).name,
    businessPhone:   (business as { phone: string | null }).phone,
    businessEmail:   (business as { email: string | null }).email,
    businessAddress: (business as { address: string | null }).address,
    total:           Number(invoice.total),
    amount:          Number(invoice.amount),
    taxAmount:       Number(invoice.tax_amount),
    taxRate:         Number(invoice.tax_rate),
    dueDate:         invoice.due_date,
    createdAt:       invoice.created_at,
    paymentLink:     invoice.stripe_payment_link,
    pdfLink:         `${appUrl}/api/invoices/${id}/pdf`,
    trackingUrl:     `${appUrl}/api/invoices/${id}/track`,
    lineItems:       (Array.isArray(invoice.line_items) ? invoice.line_items : []) as LI[],
  });

  const resend = getResend();
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "invoices@crewbooks.app";

  const { error: sendError } = await resend.emails.send({
    from:    `${(business as { name: string }).name} via CrewBooks <${fromAddress}>`,
    to:      customer.email,
    subject,
    html,
  });

  if (sendError) {
    return { error: "Failed to send email: " + (sendError as { message?: string }).message };
  }

  // Transition to "sent" if still draft, otherwise just update sent_at
  if (invoice.status === "draft") {
    const { transitionInvoice } = await import("@/lib/invoice-transition");
    await transitionInvoice(id, "sent", {
      sentVia: "email",
      changedBy: user.email ?? user.id,
      note: "Sent via email",
    });
  } else {
    await admin
      .from("invoices")
      .update({ sent_at: new Date().toISOString(), sent_via: "email" } as never)
      .eq("id", id);
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { error: null };
}
