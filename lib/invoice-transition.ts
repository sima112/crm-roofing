/**
 * lib/invoice-transition.ts
 * Server-only: transitionInvoice uses the admin client.
 * Do NOT import this in client components.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  canTransition,
  type InvoiceStatus,
  type StatusHistoryEntry,
} from "@/lib/invoice-status";

export async function transitionInvoice(
  invoiceId: string,
  newStatus: InvoiceStatus,
  opts?: {
    note?: string;
    changedBy?: string;
    paymentMethod?: string;
    paymentReference?: string;
    partialAmount?: number;
    disputeReason?: string;
    sentVia?: string;
  }
): Promise<{ error: string | null }> {
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select("status, status_history, total")
    .eq("id", invoiceId)
    .single();

  if (!inv) return { error: "Invoice not found" };

  const invData = inv as { status: string; status_history: StatusHistoryEntry[]; total: number };

  if (!canTransition(invData.status, newStatus)) {
    return { error: `Cannot transition from '${invData.status}' to '${newStatus}'` };
  }

  const historyEntry: StatusHistoryEntry = {
    status:     newStatus,
    changed_at: new Date().toISOString(),
    changed_by: opts?.changedBy ?? null,
    note:       opts?.note ?? null,
  };

  const history = Array.isArray(invData.status_history)
    ? [...invData.status_history, historyEntry]
    : [historyEntry];

  const updates: Record<string, unknown> = {
    status:         newStatus,
    status_history: history,
  };

  if (newStatus === "paid") {
    updates.paid_date         = new Date().toISOString();
    updates.payment_method    = opts?.paymentMethod   ?? null;
    updates.payment_reference = opts?.paymentReference ?? null;
  }
  if (newStatus === "partial") {
    updates.partial_paid_amount = opts?.partialAmount ?? 0;
    updates.payment_method      = opts?.paymentMethod ?? null;
  }
  if (newStatus === "disputed") {
    updates.disputed       = true;
    updates.dispute_reason = opts?.disputeReason ?? null;
  }
  if (newStatus === "sent" && opts?.sentVia) {
    updates.sent_via = opts.sentVia;
    updates.sent_at  = new Date().toISOString();
  }

  const { error } = await admin
    .from("invoices")
    .update(updates as never)
    .eq("id", invoiceId);

  return { error: error?.message ?? null };
}
