import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDetailClient } from "./invoice-detail-client";

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

  return (
    <InvoiceDetailClient
      invoice={{
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        amount: Number(invoice.amount),
        tax_rate: Number(invoice.tax_rate),
        tax_amount: Number(invoice.tax_amount),
        total: Number(invoice.total),
        due_date: invoice.due_date,
        paid_date: invoice.paid_date,
        created_at: invoice.created_at,
        notes: invoice.notes,
        stripe_payment_link: invoice.stripe_payment_link,
        line_items: (Array.isArray(invoice.line_items) ? invoice.line_items : []) as LI[],
        customer: invoice.customers as unknown as { name: string; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; zip: string | null } | null,
        job_title: (invoice.jobs as unknown as { title: string } | null)?.title ?? null,
        business,
      }}
    />
  );
}
