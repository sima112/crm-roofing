import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CustomersClient, type CustomerRow } from "./customers-client";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/login");

  const { data: customers } = await supabase
    .from("customers")
    .select(`
      id, name, phone, email, city, state, tags, created_at,
      jobs(id, actual_amount, completed_date, status),
      invoices(total, status)
    `)
    .order("name");

  type RawCustomer = {
    id: string; name: string; phone: string | null; email: string | null;
    city: string | null; state: string | null; tags: string[] | null;
    created_at: string;
    jobs: Array<{ id: string; actual_amount: number | null; completed_date: string | null; status: string }>;
    invoices: Array<{ total: number | null; status: string }>;
  };
  const rows: CustomerRow[] = ((customers ?? []) as unknown as RawCustomer[]).map((c) => {
    const jobs = (c.jobs as Array<{
      id: string;
      actual_amount: number | null;
      completed_date: string | null;
      status: string;
    }>) ?? [];

    const invoices = (c.invoices as Array<{
      total: number | null;
      status: string;
    }>) ?? [];

    const totalRevenue = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);

    const completedJobs = jobs.filter((j) => j.status === "completed");
    const lastJobDate =
      completedJobs.length > 0
        ? completedJobs.sort(
            (a, b) =>
              new Date(b.completed_date ?? 0).getTime() -
              new Date(a.completed_date ?? 0).getTime()
          )[0].completed_date
        : null;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      city: c.city,
      state: c.state,
      tags: c.tags,
      created_at: c.created_at,
      job_count: jobs.length,
      total_revenue: totalRevenue,
      last_job_date: lastJobDate,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          {rows.length} customer{rows.length !== 1 ? "s" : ""}
        </p>
      </div>
      <CustomersClient customers={rows} />
    </div>
  );
}
