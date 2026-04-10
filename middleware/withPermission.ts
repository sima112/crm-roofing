/**
 * withPermission — API route wrapper for permission-based access control.
 *
 * Usage:
 *   export const POST = withPermission("invoices:create")(
 *     async (req, { user, business, role }) => { ... }
 *   );
 *
 * For routes with dynamic params:
 *   export const POST = withPermission("jobs:edit")(
 *     async (req, { params, user, business, role }) => {
 *       const { id } = await params;
 *     }
 *   );
 */

import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole, hasPermission, type Role, type Permission } from "@/lib/permissions";
import { logSecurityEvent } from "@/lib/password-security";

export type PermissionContext = {
  user:     { id: string; email: string };
  business: { id: string; name: string };
  role:     Role;
};

/**
 * Wraps a Next.js App Router handler with authentication + permission checks.
 * Returns 401 if not authenticated, 403 if missing permission.
 * Logs 403s to security_events.
 */
export function withPermission(permission: Permission) {
  return function <Ctx extends object = object>(
    handler: (req: NextRequest, ctx: Ctx & PermissionContext) => Promise<Response>
  ) {
    return async function (req: NextRequest, ctx: Ctx): Promise<Response> {
      // 1. Auth check
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 2. Role resolution (user_roles table → fallback to owner check)
      const admin = createAdminClient();
      const userRole = await getUserRole(admin, user.id);

      if (!userRole) {
        return NextResponse.json({ error: "Forbidden: no business found" }, { status: 403 });
      }

      // 3. Permission check
      if (!hasPermission(userRole.role, permission)) {
        await logSecurityEvent(admin, {
          type:     "unauthorized_access",
          userId:   user.id,
          email:    user.email ?? undefined,
          metadata: {
            permission,
            role:   userRole.role,
            path:   req.nextUrl.pathname,
            method: req.method,
          },
        }).catch(() => {});

        return NextResponse.json(
          { error: "Forbidden: insufficient permissions" },
          { status: 403 }
        );
      }

      // 4. Fetch business name for context
      const { data: biz } = await admin
        .from("businesses")
        .select("id, name")
        .eq("id", userRole.businessId)
        .maybeSingle();

      const business = {
        id:   userRole.businessId,
        name: (biz as { id: string; name: string } | null)?.name ?? "",
      };

      // 5. Dispatch
      return handler(req, {
        ...ctx,
        user:     { id: user.id, email: user.email ?? "" },
        business,
        role:     userRole.role,
      } as Ctx & PermissionContext);
    };
  };
}
