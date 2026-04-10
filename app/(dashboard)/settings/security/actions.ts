"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ── MFA ───────────────────────────────────────────────────────────────────────

export type MfaEnrollState = {
  error: string | null;
  qrCode: string | null;
  secret: string | null;
  factorId: string | null;
};

/** Step 1: enroll a TOTP factor — returns QR code URI and secret */
export async function enrollMfaAction(): Promise<MfaEnrollState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer:     "CrewBooks",
  });

  if (error) return { error: error.message, qrCode: null, secret: null, factorId: null };

  return {
    error:    null,
    qrCode:   data.totp.qr_code,
    secret:   data.totp.secret,
    factorId: data.id,
  };
}

/** Step 2: verify the TOTP code to complete enrollment */
export async function verifyMfaEnrollAction(
  factorId: string,
  code: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Create a challenge first
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr) return { error: challengeErr.message };

  // Verify the challenge
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (error) return { error: "Invalid code. Please try again." };
  return { error: null };
}

/** Unenroll (disable) MFA after verifying current code */
export async function disableMfaAction(
  factorId: string,
  code: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Must verify before unenrolling
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr) return { error: challengeErr.message };

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) return { error: "Invalid code. Cannot disable MFA." };

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return { error: null };
}

// ── Sessions ──────────────────────────────────────────────────────────────────

/** Sign out all other sessions (keeps current one) */
export async function revokeOtherSessionsAction(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message };
  return { error: null };
}

/** Sign out all sessions including current → redirects to login */
export async function revokeAllSessionsAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

// ── Security log export ───────────────────────────────────────────────────────

export async function downloadSecurityLogAction(): Promise<{ csv: string; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { csv: "", error: "Not authenticated" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("login_history")
    .select("created_at, success, ip_address, country, city, browser, device_type, suspicious")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  if (!rows.length) return { csv: "No security events in the last 90 days.", error: null };

  const headers = ["date", "result", "ip", "country", "city", "browser", "device", "suspicious"];
  const lines = [
    headers.join(","),
    ...rows.map((r: Record<string, unknown>) =>
      [
        r.created_at,
        r.success ? "success" : "failed",
        r.ip_address ?? "",
        r.country ?? "",
        r.city ?? "",
        r.browser ?? "",
        r.device_type ?? "",
        r.suspicious ? "yes" : "no",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ),
  ];

  return { csv: lines.join("\n"), error: null };
}
