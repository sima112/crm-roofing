import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDetailClient } from "./invoice-detail-client";
import { qboConfigured } from "@/lib/quickbooks";
import type { StatusHistoryEntry } from "@/lib/invoice-status";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.invoice_number ?? "Invoice" };
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: invoice }, { data: business }] = await Promise.all([
    supabase
      .from("invoices")
      .select(`
        id, invoice_number, status, amount, tax_rate, tax_amount, total,
        due_date, paid_date, created_at, notes, stripe_payment_link, line_items,
        qbo_invoice_id, qbo_sync_status, qbo_synced_at, qbo_sync_error,
        status_history, viewed_at, viewed_count, sent_at, sent_via,
        partial_paid_amount, payment_method, payment_reference,
        disputed, dispute_reason,
        deposit_required, deposit_amount, deposit_paid, deposit_payment_link,
        recurring, recurring_interval, recurring_next_date, recurring_end_date, recurring_parent_id,
        late_fee_amount, late_fee_applied_at,
        customers(name, phone, email, address, city, state, zip),
        jobs(title)
      `)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name, phone, email, address")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!invoice || !business) notFound();

  type LI = { description: string; quantity: number; unit_price: number; amount: number };
  type RawInv = {
    id: string; invoice_number: string; status: string; amount: unknown; tax_rate: unknown;
    tax_amount: unknown; total: unknown; due_date: string | null; paid_date: string | null;
    created_at: string; notes: string | null; stripe_payment_link: string | null;
    line_items: unknown; customers: unknown; jobs: unknown;
    qbo_invoice_id?: string | null; qbo_sync_status?: string | null;
    qbo_synced_at?: string | null; qbo_sync_error?: string | null;
    status_history?: unknown; viewed_at?: string | null; viewed_count?: number | null;
    sent_at?: string | null; sent_via?: string | null;
    partial_paid_amount?: number | null; payment_method?: string | null;
    payment_reference?: string | null; disputed?: boolean | null; dispute_reason?: string | null;
    deposit_required?: boolean | null; deposit_amount?: number | null;
    deposit_paid?: boolean | null; deposit_payment_link?: string | null;
    recurring?: boolean | null; recurring_interval?: string | null;
    recurring_next_date?: string | null; recurring_end_date?: string | null;
    recurring_parent_id?: string | null;
    late_fee_amount?: number | null; late_fee_applied_at?: string | null;
  };
  const inv = invoice as unknown as RawInv;

  return (
    <InvoiceDetailClient
      invoice={{
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: inv.status,
        amount: Number(inv.amount),
        tax_rate: Number(inv.tax_rate),
        tax_amount: Number(inv.tax_amount),
        total: Number(inv.total),
        due_date: inv.due_date,
        paid_date: inv.paid_date,
        created_at: inv.created_at,
        notes: inv.notes,
        stripe_payment_link: inv.stripe_payment_link,
        qbo_invoice_id:  inv.qbo_invoice_id  ?? null,
        qbo_sync_status: inv.qbo_sync_status ?? null,
        qbo_synced_at:   inv.qbo_synced_at   ?? null,
        qbo_sync_error:  inv.qbo_sync_error  ?? null,
        showQBO: qboConfigured,
        line_items: (Array.isArray(inv.line_items) ? inv.line_items : []) as LI[],
        customer: inv.customers as { name: string; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; zip: string | null } | null,
        job_title: (inv.jobs as { title: string } | null)?.title ?? null,
        business: business as { name: string; phone: string | null; email: string | null; address: string | null },
        status_history: (Array.isArray(inv.status_history) ? inv.status_history : []) as StatusHistoryEntry[],
        viewed_at:           inv.viewed_at           ?? null,
        viewed_count:        inv.viewed_count        ?? 0,
        sent_at:             inv.sent_at             ?? null,
        sent_via:            inv.sent_via            ?? null,
        partial_paid_amount: inv.partial_paid_amount != null ? Number(inv.partial_paid_amount) : null,
        payment_method:      inv.payment_method      ?? null,
        payment_reference:   inv.payment_reference   ?? null,
        disputed:            inv.disputed            ?? false,
        dispute_reason:      inv.dispute_reason      ?? null,
        deposit_required:    inv.deposit_required    ?? false,
        deposit_amount:      inv.deposit_amount != null ? Number(inv.deposit_amount) : null,
        deposit_paid:        inv.deposit_paid         ?? false,
        deposit_payment_link: inv.deposit_payment_link ?? null,
        recurring:           inv.recurring            ?? false,
        recurring_interval:  inv.recurring_interval   ?? null,
        recurring_next_date: inv.recurring_next_date  ?? null,
        recurring_end_date:  inv.recurring_end_date   ?? null,
        late_fee_amount:     inv.late_fee_amount != null ? Number(inv.late_fee_amount) : 0,
        late_fee_applied_at: inv.late_fee_applied_at  ?? null,
      }}
    />
  );
}
