import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildICS, type ICSEvent } from "@/lib/ics";

export const runtime = "nodejs";

/**
 * GET /api/jobs/export-ics
 * Returns a downloadable .ics file with all upcoming scheduled jobs.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, title, description, scheduled_date, scheduled_time, created_at,
      customers(name, phone, address, city, state, zip)
    `)
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true, nullsFirst: false });

  const events: ICSEvent[] = (jobs ?? []).map((job) => {
    const customer = job.customers as unknown as {
      name: string;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null;

    const location = [
      customer?.address,
      [customer?.city, customer?.state, customer?.zip].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(", ");

    const descParts: string[] = [];
    if (job.description) descParts.push(job.description);
    if (customer?.phone) descParts.push(`Phone: ${customer.phone}`);
    if (location) descParts.push(`Address: ${location}`);

    return {
      uid: `job-${job.id}@crewbooks`,
      summary: `${customer?.name ?? "Customer"} — ${job.title}`,
      description: descParts.join("\n") || undefined,
      location: location || undefined,
      startDate: job.scheduled_date,
      startTime: job.scheduled_time ?? null,
      created: job.created_at,
    };
  });

  if (events.length === 0) {
    return NextResponse.json({ error: "No upcoming jobs to export" }, { status: 404 });
  }

  const ics = buildICS(events, "CrewBooks — Upcoming Jobs");
  const filename = `crewbooks-jobs-${today}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
