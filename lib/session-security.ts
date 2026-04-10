/**
 * Session security utilities — SERVER ONLY.
 * Handles brute-force lockout, suspicious login detection, login logging.
 */

import "server-only";
import { sendEmail } from "@/lib/resend";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS       = 5;
const ATTEMPT_WINDOW_MS  = 15 * 60 * 1000;  // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ADMIN_REVIEW_THRESHOLD = 10;           // lockouts before admin flag

// ─────────────────────────────────────────────────────────────────────────────
// Device / browser parsing (no external library needed)
// ─────────────────────────────────────────────────────────────────────────────

export function parseUserAgent(ua: string): { browser: string; deviceType: string } {
  const lower = ua.toLowerCase();

  const deviceType =
    /mobile|android|iphone|ipad|tablet/.test(lower)
      ? /tablet|ipad/.test(lower) ? "tablet" : "mobile"
      : "desktop";

  const browser =
    lower.includes("edg/")     ? "Edge" :
    lower.includes("chrome/")  ? "Chrome" :
    lower.includes("firefox/") ? "Firefox" :
    lower.includes("safari/")  ? "Safari" :
    lower.includes("opera/")   ? "Opera" :
    "Unknown";

  return { browser, deviceType };
}

// ─────────────────────────────────────────────────────────────────────────────
// IP Geolocation (ip-api.com free tier, no key required)
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoInfo {
  country: string;
  city: string;
  countryCode: string;
}

export async function getGeoInfo(ip: string): Promise<GeoInfo | null> {
  // Skip for localhost / private ranges
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168") || ip.startsWith("10.")) {
    return null;
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`,
      { signal: AbortSignal.timeout(3_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { status: string; country: string; countryCode: string; city: string };
    if (data.status !== "success") return null;
    return { country: data.country, city: data.city, countryCode: data.countryCode };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brute-force lockout
// ─────────────────────────────────────────────────────────────────────────────

export interface LockoutStatus {
  locked: boolean;
  lockedUntil?: Date;
  attemptsRemaining?: number;
}

export async function checkLockout(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  email: string
): Promise<LockoutStatus> {
  // Count failed attempts in the last window
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const { count } = await adminClient
    .from("login_history")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", since);

  const failures = count ?? 0;

  if (failures >= MAX_ATTEMPTS) {
    // Find the most recent failure to compute lockout expiry
    const { data: lastFail } = await adminClient
      .from("login_history")
      .select("created_at")
      .eq("email", email)
      .eq("success", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lockedAt   = lastFail?.created_at ? new Date(lastFail.created_at) : new Date();
    const lockedUntil = new Date(lockedAt.getTime() + LOCKOUT_DURATION_MS);

    if (lockedUntil > new Date()) {
      return { locked: true, lockedUntil };
    }
  }

  return {
    locked: false,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failures),
  };
}

/** Record a login attempt and handle lockout side-effects. */
export async function recordLoginAttempt(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  opts: {
    userId?: string;
    email: string;
    success: boolean;
    ip?: string;
    userAgent?: string;
    geo?: GeoInfo | null;
    suspicious?: boolean;
  }
): Promise<void> {
  const { browser, deviceType } = opts.userAgent ? parseUserAgent(opts.userAgent) : { browser: "Unknown", deviceType: "unknown" };

  await adminClient.from("login_history").insert({
    user_id:     opts.userId ?? null,
    email:       opts.email,
    success:     opts.success,
    ip_address:  opts.ip ?? null,
    user_agent:  opts.userAgent ?? null,
    country:     opts.geo?.country ?? null,
    city:        opts.geo?.city ?? null,
    device_type: deviceType,
    browser,
    suspicious:  opts.suspicious ?? false,
  });

  // On failure, check if we just hit the lockout threshold
  if (!opts.success) {
    await maybeTriggerLockout(adminClient, opts.email, opts.userId);
  }
}

async function maybeTriggerLockout(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  email: string,
  userId?: string
): Promise<void> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const { count } = await adminClient
    .from("login_history")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", since);

  const failures = count ?? 0;
  if (failures !== MAX_ATTEMPTS) return; // only trigger at exactly the threshold

  const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

  // Bump lockout count on the business row if we have a userId
  if (userId) {
    const { data: biz } = await adminClient
      .from("businesses")
      .select("total_lockout_count")
      .eq("owner_id", userId)
      .maybeSingle();

    const newCount = ((biz as { total_lockout_count?: number } | null)?.total_lockout_count ?? 0) + 1;

    await adminClient.from("businesses").update({
      login_locked_until:    lockedUntil.toISOString(),
      total_lockout_count:   newCount,
      requires_admin_review: newCount >= ADMIN_REVIEW_THRESHOLD,
    } as never).eq("owner_id", userId);
  }

  // Send unlock email
  const unlockTime = lockedUntil.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  await sendEmail({
    to:      email,
    subject: "Your CrewBooks account has been temporarily locked",
    html: `
      <p>Hi,</p>
      <p>We detected multiple failed login attempts on your CrewBooks account.</p>
      <p>Your account has been <strong>temporarily locked until ${unlockTime}</strong> (30 minutes).</p>
      <p>If this was you, simply wait and try again after ${unlockTime}.</p>
      <p>If this wasn't you, your account may be under attack. We recommend:
        <ul>
          <li>Changing your password immediately after the lockout period</li>
          <li>Enabling two-factor authentication in Settings → Security</li>
        </ul>
      </p>
      <p>Questions? Reply to this email or contact <a href="mailto:support@crewbooks.app">support@crewbooks.app</a>.</p>
    `,
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspicious login detection
// ─────────────────────────────────────────────────────────────────────────────

export async function detectSuspiciousLogin(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  opts: {
    userId: string;
    email: string;
    ip?: string;
    userAgent?: string;
    geo?: GeoInfo | null;
  }
): Promise<boolean> {
  const { browser, deviceType } = opts.userAgent
    ? parseUserAgent(opts.userAgent)
    : { browser: "Unknown", deviceType: "unknown" };

  // Get last 10 successful logins for comparison
  const { data: history } = await adminClient
    .from("login_history")
    .select("country, browser, device_type, created_at")
    .eq("user_id", opts.userId)
    .eq("success", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!history?.length) return false; // first login — not suspicious

  const knownCountries = new Set(history.map((h: { country: string | null }) => h.country).filter(Boolean));
  const knownBrowsers  = new Set(history.map((h: { browser: string | null }) => h.browser).filter(Boolean));

  const newCountry = opts.geo?.country && !knownCountries.has(opts.geo.country);
  const newBrowser = browser !== "Unknown" && !knownBrowsers.has(browser);

  // Odd-hour check (midnight–5am UTC as a proxy — real tz detection needs more infra)
  const hour = new Date().getUTCHours();
  const oddHour = hour >= 0 && hour < 5;

  const suspicious = newCountry || (newBrowser && oddHour);

  if (suspicious) {
    await sendSuspiciousLoginAlert(opts.email, {
      ip:         opts.ip ?? "Unknown",
      location:   opts.geo ? `${opts.geo.city}, ${opts.geo.country}` : "Unknown",
      browser,
      deviceType,
      time:       new Date().toUTCString(),
    });
  }

  return suspicious;
}

async function sendSuspiciousLoginAlert(
  email: string,
  details: { ip: string; location: string; browser: string; deviceType: string; time: string }
): Promise<void> {
  await sendEmail({
    to:      email,
    subject: "Suspicious login detected on your CrewBooks account",
    html: `
      <p>Hi,</p>
      <p>We detected a login to your CrewBooks account from an unfamiliar location or device.</p>
      <table style="border-collapse:collapse;width:100%;max-width:400px">
        <tr><td style="padding:6px;font-weight:bold">Time</td><td style="padding:6px">${details.time}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Location</td><td style="padding:6px">${details.location}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">IP Address</td><td style="padding:6px">${details.ip}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Browser</td><td style="padding:6px">${details.browser}</td></tr>
        <tr><td style="padding:6px;font-weight:bold">Device</td><td style="padding:6px">${details.deviceType}</td></tr>
      </table>
      <p style="margin-top:16px">
        <strong>If this wasn't you</strong>, change your password immediately:
        <br><a href="${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=account" style="color:#0d9488">
          Change password →
        </a>
      </p>
      <p>If this was you, you can safely ignore this email.</p>
    `,
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Login history queries (for /settings/security)
// ─────────────────────────────────────────────────────────────────────────────

export type LoginHistoryRow = {
  id: string;
  success: boolean;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  device_type: string | null;
  suspicious: boolean;
  created_at: string;
};

export async function getLoginHistory(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  limit = 20
): Promise<LoginHistoryRow[]> {
  const { data } = await adminClient
    .from("login_history")
    .select("id, success, ip_address, country, city, browser, device_type, suspicious, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as LoginHistoryRow[];
}
