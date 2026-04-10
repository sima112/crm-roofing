/**
 * Password security utilities — SERVER ONLY.
 * Uses Node.js crypto, bcryptjs, and Supabase admin client.
 * Do NOT import this in client components.
 */

import "server-only";
import crypto from "crypto";

// Re-export the client-safe validation helpers so server code has one import
export {
  checkPasswordStrength,
  validatePasswordComplexity,
  type PasswordChecks,
  type PasswordStrength,
} from "@/lib/password-validation";

// ─────────────────────────────────────────────────────────────────────────────
// HIBP k-anonymity breach check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the password appears in the HIBP database.
 * Uses k-anonymity: only the first 5 hex chars of SHA-1 are sent.
 * Returns false on network error — never blocks signup on API failure.
 */
export async function checkPasswordBreached(password: string): Promise<boolean> {
  try {
    const hash   = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) return false;

    const text = await res.text();
    for (const line of text.split("\n")) {
      const [lineSuffix, countStr] = line.split(":");
      if (lineSuffix.trim() === suffix && parseInt(countStr.trim(), 10) > 0) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password history (bcrypt)
// ─────────────────────────────────────────────────────────────────────────────

const HISTORY_DEPTH = 5;

/** Hash a plaintext password for storage in password_history */
export async function hashPassword(plaintext: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(plaintext, 12);
}

/**
 * Returns true if `plaintext` matches any of the last HISTORY_DEPTH
 * stored hashes for this user.
 */
export async function isPasswordReused(
  userId: string,
  plaintext: string,
  adminClient: import("@supabase/supabase-js").SupabaseClient
): Promise<boolean> {
  const { data } = await adminClient
    .from("password_history")
    .select("hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_DEPTH);

  if (!data?.length) return false;

  const bcrypt = await import("bcryptjs");
  for (const row of data) {
    if (await bcrypt.compare(plaintext, (row as { hash: string }).hash)) return true;
  }
  return false;
}

/** Append a new hash and prune entries beyond HISTORY_DEPTH */
export async function recordPasswordHistory(
  userId: string,
  plaintext: string,
  adminClient: import("@supabase/supabase-js").SupabaseClient
): Promise<void> {
  const hash = await hashPassword(plaintext);

  await adminClient.from("password_history").insert({ user_id: userId, hash });

  // Prune oldest entries beyond depth limit
  const { data: rows } = await adminClient
    .from("password_history")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (rows && rows.length > HISTORY_DEPTH) {
    const toDelete = rows.slice(HISTORY_DEPTH).map((r: { id: string }) => r.id);
    await adminClient.from("password_history").delete().in("id", toDelete);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Security event logging
// ─────────────────────────────────────────────────────────────────────────────

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "password_changed"
  | "password_reset_requested"
  | "signup"
  | "account_locked"
  | "unauthorized_access"
  | "team_invite_sent"
  | "team_member_added"
  | "team_role_changed"
  | "team_member_suspended"
  | "team_member_removed"
  | "invitation_accepted";

export async function logSecurityEvent(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  event: {
    type: SecurityEventType;
    userId?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await adminClient.from("security_events").insert({
      user_id:    event.userId ?? null,
      event_type: event.type,
      email:      event.email ?? null,
      metadata:   event.metadata ?? null,
    });
  } catch {
    // Never throw — logging failure should not break the primary action
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Forgot-password rate limiting (3 per email per hour)
// ─────────────────────────────────────────────────────────────────────────────

const FORGOT_PW_LIMIT    = 3;
const FORGOT_PW_WINDOW_H = 1;

export async function isForgotPasswordRateLimited(
  email: string,
  adminClient: import("@supabase/supabase-js").SupabaseClient
): Promise<boolean> {
  const since = new Date(
    Date.now() - FORGOT_PW_WINDOW_H * 60 * 60 * 1000
  ).toISOString();

  const { count } = await adminClient
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("event_type", "password_reset_requested")
    .gte("created_at", since);

  return (count ?? 0) >= FORGOT_PW_LIMIT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password rotation (90-day policy for Pro plan)
// ─────────────────────────────────────────────────────────────────────────────

const ROTATION_DAYS         = 90;
const ROTATION_WARNING_DAYS = 14;

export type RotationStatus =
  | { status: "ok" }
  | { status: "warning"; daysLeft: number }
  | { status: "expired" };

/**
 * Check if a user's password needs rotation.
 * Returns "ok" | "warning" (within 14 days) | "expired" (past 90 days).
 */
export async function checkPasswordRotation(
  userId: string,
  adminClient: import("@supabase/supabase-js").SupabaseClient
): Promise<RotationStatus> {
  const { data } = await adminClient
    .from("businesses")
    .select("password_changed_at, subscription_status")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!data) return { status: "ok" };

  // Only enforce for Pro plan
  const isPro = data.subscription_status === "pro" || data.subscription_status === "active";
  if (!isPro) return { status: "ok" };

  const lastChanged = data.password_changed_at
    ? new Date(data.password_changed_at)
    : null;

  if (!lastChanged) return { status: "ok" };

  const daysSince = Math.floor((Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince >= ROTATION_DAYS) return { status: "expired" };
  if (daysSince >= ROTATION_DAYS - ROTATION_WARNING_DAYS) {
    return { status: "warning", daysLeft: ROTATION_DAYS - daysSince };
  }
  return { status: "ok" };
}

/** Stamp password_changed_at = now() after a successful password change. */
export async function stampPasswordChangedAt(
  userId: string,
  adminClient: import("@supabase/supabase-js").SupabaseClient
): Promise<void> {
  await adminClient
    .from("businesses")
    .update({ password_changed_at: new Date().toISOString() } as never)
    .eq("owner_id", userId);
}
