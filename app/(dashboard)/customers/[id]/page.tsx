import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CustomerDetailClient } from "./customer-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return { title: (data as { name?: string } | null)?.name ?? "Customer" };
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: customer }, { data: jobs }, { data: invoices }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("jobs")
        .select(
          "id, title, status, scheduled_date, completed_date, actual_amount, estimated_amount, created_at"
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, status, total, due_date, paid_date, created_at"
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!customer) notFound();

  return (
    <CustomerDetailClient
      customer={customer}
      jobs={jobs ?? []}
      invoices={invoices ?? []}
    />
  );
}
