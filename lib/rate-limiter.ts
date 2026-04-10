/**
 * Supabase-based sliding-window rate limiter.
 * Uses the security_events table — no Redis required.
 * SERVER ONLY.
 */

import "server-only";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check + record a rate-limited action.
 *
 * @param adminClient  Supabase admin client
 * @param key          Unique key for this limit (e.g. "login:user@example.com")
 * @param eventType    The event_type value stored in security_events
 * @param limit        Max allowed events in the window
 * @param windowMs     Window size in milliseconds
 */
export async function checkRateLimit(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  key: string,
  eventType: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const since  = new Date(Date.now() - windowMs).toISOString();
  const resetAt = new Date(Date.now() + windowMs);

  const { count } = await adminClient
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .eq("email", key)
    .gte("created_at", since);

  const used      = count ?? 0;
  const remaining = Math.max(0, limit - used);
  const allowed   = used < limit;

  return { allowed, remaining, resetAt };
}

/**
 * Simpler boolean check without recording — just reads existing events.
 */
export async function isRateLimited(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  email: string,
  eventType: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const result = await checkRateLimit(adminClient, email, eventType, limit, windowMs);
  return !result.allowed;
}
