import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { JobsClient, type JobSummary } from "./jobs-client";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, title, status, priority,
      scheduled_date, scheduled_time,
      actual_amount, estimated_amount,
      customers(id, name)
    `)
    .order("scheduled_date", { ascending: true, nullsFirst: false });

  const rows: JobSummary[] = (jobs ?? []).map((j) => {
    const customer = j.customers as unknown as { id: string; name: string } | null;
    return {
      id: j.id,
      title: j.title,
      status: j.status,
      priority: j.priority,
      scheduled_date: j.scheduled_date,
      scheduled_time: j.scheduled_time,
      actual_amount: j.actual_amount,
      estimated_amount: j.estimated_amount,
      customer_name: customer?.name ?? "Unknown",
      customer_id: customer?.id ?? "",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          {rows.length} job{rows.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <JobsClient jobs={rows} />
    </div>
  );
}
