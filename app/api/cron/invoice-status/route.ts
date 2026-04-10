import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionInvoice } from "@/lib/invoice-transition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LI = { description: string; quantity: number; unit_price: number; amount: number };

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function nextRecurringDate(from: Date, interval: string): Date {
  switch (interval) {
    case "monthly":     return addMonths(from, 1);
    case "quarterly":   return addMonths(from, 3);
    case "semi_annual": return addMonths(from, 6);
    case "annual":      return addMonths(from, 12);
    default:            return addMonths(from, 1);
  }
}

/**
 * POST /api/cron/invoice-status
 * Runs daily at 8 AM. Does three things:
 * 1. Mark past-due sent/viewed invoices as overdue
 * 2. Apply late fees to overdue invoices past the grace period
 * 3. Generate recurring invoices for paid recurring invoices
 *
 * Protected by x-cron-secret header (or CRON_SECRET env var).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // ── 1. Mark overdue ──────────────────────────────────────────────────────
  const { data: toMark } = await admin
    .from("invoices")
    .select("id, status")
    .in("status", ["sent", "viewed"])
    .lt("due_date", todayStr)
    .not("due_date", "is", null);

  let overdueMarked = 0;
  const overdueErrors: string[] = [];

  for (const inv of toMark ?? []) {
    const { error } = await transitionInvoice(
      (inv as { id: string }).id,
      "overdue",
      { note: "Auto-marked overdue by system" }
    );
    if (error) overdueErrors.push(error);
    else overdueMarked++;
  }

  // ── 2. Apply late fees ───────────────────────────────────────────────────
  // Fetch each business's late fee settings along with their overdue invoices
  const { data: overdueInvoices } = await admin
    .from("invoices")
    .select(`
      id, amount, tax_rate, total, due_date, line_items, late_fee_amount,
      businesses(id, late_fee_settings)
    `)
    .eq("status", "overdue")
    .eq("late_fee_amount", 0)
    .not("due_date", "is", null);

  let feesApplied = 0;

  for (const inv of overdueInvoices ?? []) {
    const i = inv as unknown as {
      id: string;
      amount: number;
      tax_rate: number;
      total: number;
      due_date: string;
      line_items: LI[];
      late_fee_amount: number;
      businesses: {
        id: string;
        late_fee_settings: {
          enabled?: boolean;
          type?: "flat" | "percentage";
          amount?: number;
          grace_period_days?: number;
          max_late_fee?: number;
        } | null;
      } | null;
    };

    const settings = i.businesses?.late_fee_settings;
    if (!settings?.enabled) continue;

    const graceDays   = settings.grace_period_days ?? 7;
    const dueDate     = new Date(i.due_date + "T00:00:00");
    const graceEnd    = new Date(dueDate.getTime() + graceDays * 86_400_000);
    if (today < graceEnd) continue; // still in grace period

    // Calculate fee
    let feeAmount = 0;
    const base = Number(i.total);
    if (settings.type === "flat") {
      feeAmount = settings.amount ?? 25;
    } else {
      feeAmount = (base * (settings.amount ?? 1.5)) / 100;
      if ((settings.max_late_fee ?? 0) > 0) {
        feeAmount = Math.min(feeAmount, settings.max_late_fee!);
      }
    }
    feeAmount = Math.round(feeAmount * 100) / 100;
    if (feeAmount <= 0) continue;

    // Add late fee line item
    const existing: LI[] = Array.isArray(i.line_items) ? i.line_items : [];
    const feeLabel = `Late fee (applied ${todayStr})`;
    const feeLineItem: LI = { description: feeLabel, quantity: 1, unit_price: feeAmount, amount: feeAmount };
    const newLineItems = [...existing, feeLineItem];
    const newAmount = newLineItems.reduce((s, li) => s + li.amount, 0);

    await admin.from("invoices").update({
      late_fee_amount:     feeAmount,
      late_fee_applied_at: today.toISOString(),
      line_items:          newLineItems,
      amount:              newAmount,
    } as never).eq("id", i.id);

    feesApplied++;
  }

  // ── 3. Generate recurring invoices ───────────────────────────────────────
  const { data: recurringDue } = await admin
    .from("invoices")
    .select(`
      id, business_id, customer_id, job_id, amount, tax_rate, due_date,
      notes, line_items, recurring_interval, recurring_next_date, recurring_end_date,
      deposit_required, deposit_amount
    `)
    .eq("status", "paid")
    .eq("recurring", true)
    .lte("recurring_next_date", todayStr)
    .not("recurring_next_date", "is", null);

  let recurringCreated = 0;

  for (const parent of recurringDue ?? []) {
    const p = parent as unknown as {
      id: string;
      business_id: string;
      customer_id: string;
      job_id: string | null;
      amount: number;
      tax_rate: number;
      due_date: string | null;
      notes: string | null;
      line_items: LI[];
      recurring_interval: string;
      recurring_next_date: string;
      recurring_end_date: string | null;
      deposit_required: boolean;
      deposit_amount: number | null;
    };

    // Don't generate if past end date
    if (p.recurring_end_date && p.recurring_next_date > p.recurring_end_date) continue;

    const nextDate = nextRecurringDate(new Date(p.recurring_next_date + "T00:00:00"), p.recurring_interval);

    // Calculate new due date (same offset from next date as original)
    let newDueDate: string | null = null;
    if (p.due_date) {
      const origDue = new Date(p.due_date + "T00:00:00");
      const diffMs = origDue.getTime() - new Date(p.recurring_next_date + "T00:00:00").getTime();
      const dueDateCalc = new Date(new Date(p.recurring_next_date + "T00:00:00").getTime() + diffMs);
      newDueDate = dueDateCalc.toISOString().slice(0, 10);
    }

    // Clone line items (remove any late fees)
    const clonedItems = (Array.isArray(p.line_items) ? p.line_items : []).filter(
      (li) => !li.description.startsWith("Late fee")
    );
    const clonedAmount = clonedItems.reduce((s, li) => s + li.amount, 0);

    const { data: newInv } = await admin
      .from("invoices")
      .insert({
        business_id:        p.business_id,
        customer_id:        p.customer_id,
        job_id:             p.job_id,
        invoice_number:     "", // trigger auto-generates
        amount:             clonedAmount,
        tax_rate:           p.tax_rate,
        status:             "draft",
        due_date:           newDueDate,
        notes:              p.notes,
        line_items:         clonedItems,
        recurring:          true,
        recurring_interval: p.recurring_interval,
        recurring_end_date: p.recurring_end_date,
        recurring_parent_id: p.id,
        recurring_next_date: nextDate.toISOString().slice(0, 10),
        deposit_required:   p.deposit_required,
        deposit_amount:     p.deposit_amount,
      } as never)
      .select("id")
      .single();

    if (!newInv) continue;

    // Update parent's recurring_next_date to the next future interval
    await admin
      .from("invoices")
      .update({ recurring_next_date: nextDate.toISOString().slice(0, 10) } as never)
      .eq("id", p.id);

    recurringCreated++;
  }

  console.log(
    `[invoice-status cron] overdue=${overdueMarked} fees=${feesApplied} recurring=${recurringCreated} errors=${overdueErrors.length}`
  );
  return NextResponse.json({ overdueMarked, feesApplied, recurringCreated, errors: overdueErrors });
}
