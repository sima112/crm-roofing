import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sms/remind
 * Batch-processes all pending reminders whose scheduled_for <= now().
 * Should be called by a cron job (Vercel Cron or Supabase pg_cron).
 * Requires header: x-cron-secret: <CRON_SECRET>
 *
 * Returns: { processed, sent, failed }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id, phone, message")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(100);

  if (error) {
    console.error("[remind] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders ?? []) {
    const { error: smsError } = await sendSMS({
      to: reminder.phone,
      body: reminder.message,
    });

    if (smsError) {
      failed++;
      await supabase
        .from("reminders")
        .update({ status: "failed" } as never)
        .eq("id", reminder.id);
      console.warn(`[remind] failed reminder ${reminder.id}: ${smsError}`);
    } else {
      sent++;
      await supabase
        .from("reminders")
        .update({ status: "sent", sent_at: new Date().toISOString() } as never)
        .eq("id", reminder.id);
    }
  }

  const processed = reminders?.length ?? 0;
  console.log(`[remind] processed=${processed} sent=${sent} failed=${failed}`);
  return NextResponse.json({ processed, sent, failed });
}
