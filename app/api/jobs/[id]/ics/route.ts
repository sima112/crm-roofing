import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildICS, type ICSEvent } from "@/lib/ics";

export const runtime = "nodejs";

/**
 * GET /api/jobs/[id]/ics
 * Returns a downloadable .ics file for a single job.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase
    .from("jobs")
    .select(`
      id, title, description, scheduled_date, scheduled_time, created_at,
      customers(name, phone, address, city, state, zip)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!job || !job.scheduled_date) {
    return NextResponse.json({ error: "Job not found or not scheduled" }, { status: 404 });
  }

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

  const event: ICSEvent = {
    uid: `job-${job.id}@crewbooks`,
    summary: `${customer?.name ?? "Customer"} — ${job.title}`,
    description: descParts.join("\n") || undefined,
    location: location || undefined,
    startDate: job.scheduled_date,
    startTime: job.scheduled_time ?? null,
    created: job.created_at,
  };

  const ics = buildICS([event], "CrewBooks Jobs");
  const filename = `job-${(job.title as string).replace(/\s+/g, "-").toLowerCase()}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
