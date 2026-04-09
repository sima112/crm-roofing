import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { InvoicesClient, type InvoiceRow } from "./invoices-client";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, status, amount, tax_amount, total,
      due_date, paid_date, created_at, stripe_payment_link,
      customers(name),
      jobs(title)
    `)
    .order("created_at", { ascending: false });

  const rows: InvoiceRow[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    amount: Number(inv.amount ?? 0),
    tax_amount: Number(inv.tax_amount ?? 0),
    total: Number(inv.total ?? 0),
    due_date: inv.due_date,
    paid_date: inv.paid_date,
    created_at: inv.created_at,
    stripe_payment_link: inv.stripe_payment_link,
    customer_name: (inv.customers as unknown as { name: string } | null)?.name ?? "—",
    job_title: (inv.jobs as unknown as { title: string } | null)?.title ?? null,
  }));

  const outstanding = rows
    .filter((r) => r.status === "sent" || r.status === "overdue")
    .reduce((s, r) => s + r.total, 0);

  const paidThisMonth = rows
    .filter((r) => r.status === "paid" && r.paid_date && r.paid_date >= monthStart)
    .reduce((s, r) => s + r.total, 0);

  const overdueCount = rows.filter((r) => r.status === "overdue").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">
          {rows.length} invoice{rows.length !== 1 ? "s" : ""}
        </p>
      </div>
      <InvoicesClient
        invoices={rows}
        summaryCards={{ outstanding, paidThisMonth, overdueCount }}
      />
    </div>
  );
}
