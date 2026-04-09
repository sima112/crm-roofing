"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms";

// ── Create job ────────────────────────────────────────────────────────────────

export type JobFormState = { error: string | null; success: boolean; id?: string };

export async function createJobAction(
  _prev: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, reminder_settings")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { error: "Business not found", success: false };

  const title = (formData.get("title") as string)?.trim();
  const customer_id = formData.get("customer_id") as string;
  if (!title) return { error: "Job title is required", success: false };
  if (!customer_id) return { error: "Customer is required", success: false };

  const estimatedRaw = formData.get("estimated_amount") as string;
  const estimated_amount = estimatedRaw ? parseFloat(estimatedRaw) : null;
  const scheduled_date = (formData.get("scheduled_date") as string) || null;
  const scheduled_time = (formData.get("scheduled_time") as string) || null;

  const { data, error } = await supabase.from("jobs").insert({
    business_id: business.id,
    customer_id,
    title,
    description: (formData.get("description") as string) || null,
    scheduled_date,
    scheduled_time,
    priority: (formData.get("priority") as string) || "normal",
    estimated_amount,
    status: "scheduled",
  } as never).select("id").single();

  if (error) return { error: error.message, success: false };

  // Schedule appointment reminder if date is set
  if (scheduled_date) {
    await scheduleAppointmentReminder({
      supabase,
      jobId: data.id,
      businessId: business.id,
      businessName: (business as { name: string }).name,
      businessSettings: (business as { reminder_settings: unknown }).reminder_settings,
      customerId: customer_id,
      jobTitle: title,
      scheduledDate: scheduled_date,
      scheduledTime: scheduled_time,
    });
  }

  revalidatePath("/jobs");
  return { error: null, success: true, id: data.id };
}

// ── Update job field ──────────────────────────────────────────────────────────

export async function updateJobFieldAction(
  id: string,
  fields: Record<string, unknown>
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(fields as never).eq("id", id);
  if (error) return { error: error.message };

  // Re-schedule appointment reminder if date/time changed
  if ("scheduled_date" in fields || "scheduled_time" in fields) {
    await rescheduleAppointmentReminder(supabase, id, fields);
  }

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { error: null };
}

// ── Change job status ─────────────────────────────────────────────────────────

export async function changeJobStatusAction(
  id: string,
  status: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const fields: Record<string, unknown> = { status };
  if (status === "completed") {
    fields.completed_date = new Date().toISOString();
  }
  const { error } = await supabase.from("jobs").update(fields as never).eq("id", id);
  if (error) return { error: error.message };

  // Schedule follow-up reminder on completion
  if (status === "completed" && user) {
    await scheduleFollowUpReminder(supabase, id, user.id);
  }

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { error: null };
}

// ── Delete photo URL from array ───────────────────────────────────────────────

export async function deleteJobPhotoAction(
  id: string,
  url: string,
  type: "before" | "after"
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("before_photos, after_photos")
    .eq("id", id)
    .maybeSingle();
  if (!job) return { error: "Job not found" };

  const field = type === "before" ? "before_photos" : "after_photos";
  const current = (job[field] as string[] | null) ?? [];
  const updated = current.filter((u) => u !== url);

  const { error } = await supabase
    .from("jobs")
    .update({ [field]: updated } as never)
    .eq("id", id);

  if (error) return { error: error.message };

  // Also delete from Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const storagePath = url.replace(`${supabaseUrl}/storage/v1/object/public/job-photos/`, "");
  await supabase.storage.from("job-photos").remove([storagePath]);

  revalidatePath(`/jobs/${id}`);
  return { error: null };
}

// ── Manual "Text Customer" from job detail ────────────────────────────────────

export async function sendJobSMSAction(
  jobId: string,
  to: string,
  message: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("business_id, customer_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "Job not found" };

  const { error: smsError } = await sendSMS({ to, body: message });
  if (smsError) return { error: smsError };

  // Log the sent message as a manual_sms reminder row
  const admin = createAdminClient();
  await admin.from("reminders").insert({
    business_id: job.business_id,
    job_id: jobId,
    customer_id: job.customer_id,
    type: "manual_sms",
    message,
    phone: to,
    scheduled_for: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    status: "sent",
  } as never);

  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

// ── Reminder helpers (private) ────────────────────────────────────────────────

function fmtTime(t: string | null): string {
  if (!t) return "your scheduled time";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function scheduleAppointmentReminder(params: {
  supabase: SupabaseClient;
  jobId: string;
  businessId: string;
  businessName: string;
  businessSettings: unknown;
  customerId: string;
  jobTitle: string;
  scheduledDate: string;
  scheduledTime: string | null;
}) {
  const settings = params.businessSettings as {
    appointment_reminder?: { enabled: boolean; hours_before: number; template: string };
  } | null;

  const cfg = settings?.appointment_reminder ?? {
    enabled: true,
    hours_before: 24,
    template:
      "Hi {{customer_name}}, this is a reminder from {{business_name}} that your {{job_title}} appointment is tomorrow at {{time}}. Reply STOP to opt out.",
  };
  if (!cfg.enabled) return;

  const { data: customer } = await params.supabase
    .from("customers")
    .select("name, phone")
    .eq("id", params.customerId)
    .maybeSingle();

  if (!customer?.phone) return;

  const dateStr = `${params.scheduledDate}T${params.scheduledTime ?? "08:00:00"}`;
  const scheduledAt = new Date(dateStr);
  scheduledAt.setHours(scheduledAt.getHours() - cfg.hours_before);
  if (scheduledAt <= new Date()) return;

  const message = cfg.template
    .replace(/\{\{customer_name\}\}/g, customer.name)
    .replace(/\{\{business_name\}\}/g, params.businessName)
    .replace(/\{\{job_title\}\}/g, params.jobTitle)
    .replace(/\{\{time\}\}/g, fmtTime(params.scheduledTime));

  const admin = createAdminClient();
  await admin.from("reminders").insert({
    business_id: params.businessId,
    job_id: params.jobId,
    customer_id: params.customerId,
    type: "appointment_reminder",
    message,
    phone: customer.phone,
    scheduled_for: scheduledAt.toISOString(),
    status: "pending",
  } as never);
}

async function rescheduleAppointmentReminder(
  supabase: SupabaseClient,
  jobId: string,
  fields: Record<string, unknown>
) {
  const admin = createAdminClient();

  // Cancel any existing pending appointment reminder for this job
  await admin
    .from("reminders")
    .update({ status: "cancelled" } as never)
    .eq("job_id", jobId)
    .eq("type", "appointment_reminder")
    .eq("status", "pending");

  const newDate = fields.scheduled_date as string | undefined;
  if (!newDate) return;

  // Fetch full job + business to rebuild the reminder
  const { data: job } = await supabase
    .from("jobs")
    .select("title, scheduled_time, customer_id, business_id, businesses(name, reminder_settings)")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return;
  const biz = job.businesses as unknown as { name: string; reminder_settings: unknown } | null;

  await scheduleAppointmentReminder({
    supabase,
    jobId,
    businessId: job.business_id as string,
    businessName: biz?.name ?? "",
    businessSettings: biz?.reminder_settings ?? null,
    customerId: job.customer_id as string,
    jobTitle: job.title as string,
    scheduledDate: newDate,
    scheduledTime: (fields.scheduled_time as string | null) ?? (job.scheduled_time as string | null),
  });
}

async function scheduleFollowUpReminder(
  supabase: SupabaseClient,
  jobId: string,
  userId: string
) {
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, reminder_settings")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) return;

  const settings = (business as { reminder_settings: unknown }).reminder_settings as {
    follow_up?: { enabled: boolean; days_after: number; template: string };
  } | null;

  const cfg = settings?.follow_up ?? {
    enabled: true,
    days_after: 3,
    template:
      "Hi {{customer_name}}, {{business_name}} here. We hope you're happy with your {{job_title}}! If you have a moment, we'd love a Google review: {{review_link}}. Thank you!",
  };
  if (!cfg.enabled) return;

  const { data: job } = await supabase
    .from("jobs")
    .select("title, customer_id, customers(name, phone)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;

  const customer = job.customers as unknown as { name: string; phone: string | null } | null;
  if (!customer?.phone) return;

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + cfg.days_after);

  const message = cfg.template
    .replace(/\{\{customer_name\}\}/g, customer.name)
    .replace(/\{\{business_name\}\}/g, (business as { name: string }).name)
    .replace(/\{\{job_title\}\}/g, job.title as string)
    .replace(/\{\{review_link\}\}/g, "https://g.page/r/review");

  const admin = createAdminClient();
  await admin.from("reminders").insert({
    business_id: (business as { id: string }).id,
    job_id: jobId,
    customer_id: job.customer_id,
    type: "follow_up",
    message,
    phone: customer.phone,
    scheduled_for: scheduledAt.toISOString(),
    status: "pending",
  } as never);
}
