import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "../invoice-form";
import { createInvoiceAction } from "../invoice-actions";

export const metadata: Metadata = { title: "New Invoice" };

interface Props {
  searchParams: Promise<{ job_id?: string; customer_id?: string }>;
}

export default async function NewInvoicePage({ searchParams }: Props) {
  const { job_id, customer_id } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Invoices
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <InvoiceForm
          action={createInvoiceAction}
          defaultCustomerId={customer_id}
          defaultJobId={job_id}
        />
      </div>
    </div>
  );
}
