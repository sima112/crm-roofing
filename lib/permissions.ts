/**
 * Server-only permission helpers (role lookup via DB).
 * For types and pure functions, import from `@/lib/permissions-shared`.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export everything from the shared module so server code has one import
export {
  type Role,
  type Permission,
  hasPermission,
  getPermissions,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  INVITABLE_ROLES,
  SEAT_LIMITS,
} from "@/lib/permissions-shared";

import type { Role } from "@/lib/permissions-shared";

// ── Role lookup ───────────────────────────────────────────────────────────────

export type UserRoleContext = {
  userId:     string;
  businessId: string;
  role:       Role;
};

/**
 * Resolves the current user's role and business.
 * Checks `user_roles` table first (post-016 migration);
 * falls back to `businesses.owner_id` for backwards compatibility.
 */
export async function getUserRole(
  adminClient: SupabaseClient,
  userId: string
): Promise<UserRoleContext | null> {
  const { data: ur } = await adminClient
    .from("user_roles")
    .select("business_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("granted_at")
    .limit(1)
    .maybeSingle();

  if (ur) {
    return { userId, businessId: ur.business_id, role: ur.role as Role };
  }

  // Fallback: check if direct business owner
  const { data: biz } = await adminClient
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (biz) {
    return { userId, businessId: biz.id, role: "owner" as Role };
  }

  return null;
}
