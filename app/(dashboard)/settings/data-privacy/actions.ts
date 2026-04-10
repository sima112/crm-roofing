"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent, type ConsentType } from "@/lib/consent";
import { scheduleAccountDeletion } from "@/lib/gdpr";
import { logSecurityEvent } from "@/lib/password-security";
import { sendEmail } from "@/lib/resend";

export async function updateConsentAction(
  consentType: ConsentType,
  granted: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  await recordConsent(admin, {
    userId: user.id,
    consentType,
    granted,
    source: "settings",
  });

  return { error: null };
}

export type ScheduleDeletionState = { error: string | null; success: boolean };

export async function scheduleDeletionAction(
  _prevState: ScheduleDeletionState,
  formData: FormData
): Promise<ScheduleDeletionState> {
  const confirmation = formData.get("confirmation") as string;
  const password     = formData.get("password") as string;

  if (confirmation !== "DELETE MY ACCOUNT") {
    return { error: "Please type DELETE MY ACCOUNT exactly to confirm.", success: false };
  }
  if (!password) {
    return { error: "Current password is required to confirm deletion.", success: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated", success: false };

  // Re-verify password
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) return { error: "Incorrect password.", success: false };

  const admin = createAdminClient();
  const { cancelToken, deletionDate } = await scheduleAccountDeletion(admin, user.id);

  // Send confirmation email with cancel link
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancel-deletion/${cancelToken}`;

  await sendEmail({
    to:      user.email,
    subject: "Your CrewBooks account is scheduled for deletion",
    html: `
      <p>Hi,</p>
      <p>Your CrewBooks account has been scheduled for permanent deletion on <strong>${deletionDate.toDateString()}</strong>.</p>
      <p>All your data — customers, jobs, invoices, photos, and AI conversations — will be permanently deleted at that time.</p>
      <p>If you changed your mind, you can cancel this deletion within 30 days:</p>
      <p><a href="${cancelUrl}" style="color:#0d9488">Cancel account deletion →</a></p>
      <p>If you did not request this, please contact <a href="mailto:support@crewbooks.app">support@crewbooks.app</a> immediately.</p>
    `,
  }).catch(() => {}); // Don't fail if email fails

  await logSecurityEvent(admin, {
    type: "account_locked",
    userId: user.id,
    email: user.email,
    metadata: { action: "deletion_requested" },
  });

  // Sign out all sessions
  await supabase.auth.signOut({ scope: "global" });

  redirect("/login?message=deletion_scheduled");
}
