"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS, type ReminderSettings } from "./reminder-defaults";
import { redirect } from "next/navigation";

// ── Business profile ──────────────────────────────────────────────────────────

export type BusinessProfile = {
  id: string;
  name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  subscription_status: string;
  stripe_customer_id: string | null;
  created_at: string;
};

export async function getBusinessProfileAction(): Promise<BusinessProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("businesses")
    .select("id, name, trade, phone, email, address, logo_url, subscription_status, stripe_customer_id, created_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  return data as BusinessProfile | null;
}

export async function saveBusinessProfileAction(
  fields: Partial<Pick<BusinessProfile, "name" | "trade" | "phone" | "email" | "address" | "logo_url">>
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (fields.name !== undefined && !fields.name.trim()) {
    return { error: "Business name cannot be empty" };
  }

  const { error } = await supabase
    .from("businesses")
    .update(fields as never)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

// ── Reminder settings ─────────────────────────────────────────────────────────

export async function saveReminderSettingsAction(
  settings: ReminderSettings
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("businesses")
    .update({ reminder_settings: settings } as never)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

export async function getReminderSettingsAction(): Promise<ReminderSettings> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_SETTINGS;

  const { data } = await supabase
    .from("businesses")
    .select("reminder_settings")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data?.reminder_settings) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    ...(data.reminder_settings as Partial<ReminderSettings>),
  };
}

// ── Account ───────────────────────────────────────────────────────────────────

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated" };

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters" };
  }

  // Verify current password by re-signing in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Current password is incorrect" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteAccountAction(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  // Deletes user + cascades to businesses, customers, jobs, invoices via FK
  await admin.auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/login");
}
