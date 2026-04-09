import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { JobDetailClient } from "./job-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ?? "Job" };
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/login");

  const [{ data: job }, { data: invoice }, { data: smsLog }] = await Promise.all([
    supabase
      .from("jobs")
      .select(`
        id, title, status, priority, description, notes,
        scheduled_date, scheduled_time, completed_date,
        estimated_amount, actual_amount,
        before_photos, after_photos,
        created_at, updated_at,
        business_id,
        customers(id, name, phone)
      `)
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("invoices")
      .select("id, invoice_number, status, total")
      .eq("job_id", id)
      .maybeSingle(),

    supabase
      .from("reminders")
      .select("id, message, sent_at, created_at, type")
      .eq("job_id", id)
      .eq("type", "manual_sms")
      .eq("status", "sent")
      .order("sent_at", { ascending: false }),
  ]);

  if (!job) notFound();

  const customer = job.customers as unknown as { id: string; name: string; phone: string | null } | null;

  return (
    <JobDetailClient
      job={{
        ...job,
        customer,
        business_id: business.id,
        before_photos: (job.before_photos as string[] | null) ?? [],
        after_photos: (job.after_photos as string[] | null) ?? [],
      }}
      invoice={invoice ?? null}
      smsLog={smsLog ?? []}
    />
  );
}
