"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS, type ReminderSettings } from "./reminder-defaults";
import { redirect } from "next/navigation";
import {
  validatePasswordComplexity,
  checkPasswordBreached,
  isPasswordReused,
  recordPasswordHistory,
  logSecurityEvent,
  stampPasswordChangedAt,
} from "@/lib/password-security";

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

  // Complexity validation
  const complexityErrors = validatePasswordComplexity(newPassword, { email: user.email });
  if (complexityErrors.length > 0) return { error: complexityErrors[0] };

  // HIBP breach check
  const breached = await checkPasswordBreached(newPassword);
  if (breached) {
    return { error: "This password has appeared in a data breach. Please choose a different password." };
  }

  const admin = createAdminClient();

  // Password history check
  const reused = await isPasswordReused(user.id, newPassword, admin);
  if (reused) {
    return { error: "You have used this password recently. Please choose a different password." };
  }

  // Verify current password by re-signing in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Current password is incorrect" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  await recordPasswordHistory(user.id, newPassword, admin);
  await stampPasswordChangedAt(user.id, admin);
  await logSecurityEvent(admin, {
    type: "password_changed",
    userId: user.id,
    email: user.email,
  });

  return { error: null };
}

// ── QBO sync settings ─────────────────────────────────────────────────────────

export type QBOSyncSettings = {
  auto_sync_invoices:  boolean;
  auto_sync_customers: boolean;
  pull_payments:       boolean;
};

export async function saveQBOSyncSettingsAction(
  settings: QBOSyncSettings
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("businesses")
    .update({ qbo_sync_settings: settings } as never)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

export async function getQBOSyncSettingsAction(): Promise<QBOSyncSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("qbo_sync_settings")
    .single();

  const defaultSettings: QBOSyncSettings = {
    auto_sync_invoices:  true,
    auto_sync_customers: true,
    pull_payments:       true,
  };

  const raw = (data as { qbo_sync_settings?: unknown } | null)?.qbo_sync_settings;
  if (!raw || typeof raw !== "object") return defaultSettings;
  return { ...defaultSettings, ...(raw as Partial<QBOSyncSettings>) };
}

// ── Late fee settings ─────────────────────────────────────────────────────────

export type LateFeeSettings = {
  enabled:           boolean;
  type:              "flat" | "percentage";
  amount:            number;
  grace_period_days: number;
  max_late_fee:      number;
};

const DEFAULT_LATE_FEE_SETTINGS: LateFeeSettings = {
  enabled:           false,
  type:              "flat",
  amount:            25,
  grace_period_days: 7,
  max_late_fee:      0,
};

export async function getLateFeeSettingsAction(): Promise<LateFeeSettings> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_LATE_FEE_SETTINGS;

  const { data } = await supabase
    .from("businesses")
    .select("late_fee_settings")
    .eq("owner_id", user.id)
    .maybeSingle();

  const raw = (data as { late_fee_settings?: unknown } | null)?.late_fee_settings;
  if (!raw || typeof raw !== "object") return DEFAULT_LATE_FEE_SETTINGS;
  return { ...DEFAULT_LATE_FEE_SETTINGS, ...(raw as Partial<LateFeeSettings>) };
}

export async function saveLateFeeSettingsAction(
  settings: LateFeeSettings
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("businesses")
    .update({ late_fee_settings: settings } as never)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
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
