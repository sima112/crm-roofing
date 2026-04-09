import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "../../invoice-form";
import { updateInvoiceAction } from "../../invoice-actions";

export const metadata: Metadata = { title: "Edit Invoice" };

interface Props { params: Promise<{ id: string }> }

export default async function EditInvoicePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, job_id, due_date, notes, line_items, status")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);

  type LI = { description: string; quantity: number; unit_price: number; amount: number };

  async function updateAction(
    prev: { error: string | null; success: boolean },
    formData: FormData
  ) {
    "use server";
    return updateInvoiceAction(id, prev, formData);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/invoices/${id}`}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            {invoice.invoice_number}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Invoice</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <InvoiceForm
          action={updateAction}
          defaultValues={{
            customer_id: invoice.customer_id,
            job_id: invoice.job_id,
            due_date: invoice.due_date,
            notes: invoice.notes,
            line_items: (Array.isArray(invoice.line_items) ? invoice.line_items : []) as LI[],
          }}
        />
      </div>
    </div>
  );
}
