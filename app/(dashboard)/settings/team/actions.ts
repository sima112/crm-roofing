"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/permissions";
import { INVITABLE_ROLES, SEAT_LIMITS, type Role } from "@/lib/permissions-shared";
import { logSecurityEvent } from "@/lib/password-security";
import { sendEmail } from "@/lib/resend";
import crypto from "crypto";

// ── Types exported for page + client ─────────────────────────────────────────

export type TeamMember = {
  id:          string;   // user_roles.id
  userId:      string;
  email:       string;
  fullName:    string;
  role:        Role;
  status:      "active" | "suspended";
  grantedAt:   string;
  lastLoginAt: string | null;
  isCurrentUser: boolean;
};

export type PendingInvite = {
  id:        string;
  email:     string;
  role:      Role;
  expiresAt: string;
  createdAt: string;
};

export type TeamData = {
  members:      TeamMember[];
  invites:      PendingInvite[];
  seatUsed:     number;
  seatLimit:    number;
  businessName: string;
};

// ── Helper ────────────────────────────────────────────────────────────────────

async function requireTeamManage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = createAdminClient();
  const userRole = await getUserRole(admin, user.id);

  if (!userRole || !["owner", "admin"].includes(userRole.role)) {
    throw new Error("Forbidden");
  }

  return { user, admin, userRole };
}

// ── Load team data ────────────────────────────────────────────────────────────

export async function getTeamDataAction(): Promise<TeamData> {
  const { user, admin, userRole } = await requireTeamManage();

  const { data: biz } = await admin
    .from("businesses")
    .select("name, subscription_status")
    .eq("id", userRole.businessId)
    .maybeSingle();

  // Team members
  const { data: rawMembers } = await admin
    .from("user_roles")
    .select("id, user_id, role, status, granted_at")
    .eq("business_id", userRole.businessId)
    .neq("status", "removed")
    .order("granted_at");

  const members: TeamMember[] = await Promise.all(
    (rawMembers ?? []).map(async (m) => {
      let email = "Unknown";
      let fullName = "";

      try {
        const { data: { user: authUser } } = await admin.auth.admin.getUserById(m.user_id);
        email    = authUser?.email ?? "Unknown";
        fullName = (authUser?.user_metadata?.full_name as string) ?? "";
      } catch { /* admin API may fail */ }

      const { data: lastLogin } = await admin
        .from("login_history")
        .select("created_at")
        .eq("user_id", m.user_id)
        .eq("success", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id:            m.id,
        userId:        m.user_id,
        email,
        fullName,
        role:          m.role as Role,
        status:        m.status as "active" | "suspended",
        grantedAt:     m.granted_at,
        lastLoginAt:   lastLogin?.created_at ?? null,
        isCurrentUser: m.user_id === user.id,
      };
    })
  );

  // Pending invitations (not expired)
  const { data: rawInvites } = await admin
    .from("invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("business_id", userRole.businessId)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const invites: PendingInvite[] = (rawInvites ?? []).map((i) => ({
    id:        i.id,
    email:     i.email,
    role:      i.role as Role,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));

  const subStatus = (biz as { name: string; subscription_status: string } | null)?.subscription_status ?? "trial";
  const seatLimit = SEAT_LIMITS[subStatus] ?? 3;
  const seatUsed  = members.length + invites.length;

  return {
    members,
    invites,
    seatUsed,
    seatLimit,
    businessName: (biz as { name: string } | null)?.name ?? "",
  };
}

// ── Invite user ───────────────────────────────────────────────────────────────

export type InviteState = { error: string | null; success: boolean };

export async function inviteUserAction(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role  = formData.get("role") as Role;

  if (!email) return { error: "Email is required.", success: false };
  if (!INVITABLE_ROLES.includes(role)) return { error: "Invalid role.", success: false };

  let user: Awaited<ReturnType<typeof requireTeamManage>>["user"];
  let admin: Awaited<ReturnType<typeof requireTeamManage>>["admin"];
  let userRole: Awaited<ReturnType<typeof requireTeamManage>>["userRole"];

  try {
    ({ user, admin, userRole } = await requireTeamManage());
  } catch (e) {
    return { error: (e as Error).message, success: false };
  }

  // Seat limit check
  const { data: biz } = await admin
    .from("businesses")
    .select("name, subscription_status")
    .eq("id", userRole.businessId)
    .maybeSingle();

  const bizData = biz as { name: string; subscription_status: string } | null;
  const seatLimit = SEAT_LIMITS[bizData?.subscription_status ?? "trial"] ?? 3;

  const { count: memberCount } = await admin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("business_id", userRole.businessId)
    .neq("status", "removed");

  const { count: inviteCount } = await admin
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", userRole.businessId)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString());

  if (((memberCount ?? 0) + (inviteCount ?? 0)) >= seatLimit) {
    return {
      error: `Seat limit reached (${seatLimit}). Upgrade your plan to invite more team members.`,
      success: false,
    };
  }

  // Check for existing active member
  const { data: existingRole } = await admin
    .from("user_roles")
    .select("id")
    .eq("business_id", userRole.businessId)
    .in("status", ["active", "suspended"])
    .maybeSingle();

  // Check for duplicate pending invite
  const { data: existingInvite } = await admin
    .from("invitations")
    .select("id")
    .eq("business_id", userRole.businessId)
    .eq("email", email)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return { error: "This email already has a pending invitation.", success: false };
  }

  // Generate token (raw stored in URL, hash stored in DB)
  const token     = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await admin.from("invitations").insert({
    business_id: userRole.businessId,
    email,
    role,
    invited_by:  user.id,
    token_hash:  tokenHash,
    expires_at:  expiresAt,
  } as never);

  if (insertError) return { error: insertError.message, success: false };

  // Fetch inviter name for email
  let inviterName = user.email ?? "Your team";
  try {
    const { data: { user: inviterUser } } = await admin.auth.admin.getUserById(user.id);
    inviterName = (inviterUser?.user_metadata?.full_name as string) || user.email || "Your team";
  } catch { /* ignore */ }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  await sendEmail({
    to:      email,
    subject: `You've been invited to join ${bizData?.name ?? "CrewBooks"}`,
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to join
         <strong>${bizData?.name ?? "their team"}</strong> on CrewBooks as a
         <strong>${roleLabel}</strong>.</p>
      <p style="margin:24px 0">
        <a href="${inviteUrl}"
           style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Accept Invitation →
        </a>
      </p>
      <p style="color:#666;font-size:13px">This invitation expires in 72 hours.<br>
      If you didn't expect this email, you can safely ignore it.</p>
    `,
  }).catch(() => {});

  await logSecurityEvent(admin, {
    type:     "team_invite_sent",
    userId:   user.id,
    email:    user.email ?? undefined,
    metadata: { invitedEmail: email, role, businessId: userRole.businessId },
  });

  // Suppress unused variable warning
  void existingRole;

  return { error: null, success: true };
}

// ── Change role ───────────────────────────────────────────────────────────────

export type ActionState = { error: string | null; success: boolean };

export async function changeRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const targetUserId = formData.get("userId") as string;
  const newRole      = formData.get("role") as Role;

  if (!INVITABLE_ROLES.includes(newRole) && newRole !== "owner") {
    return { error: "Invalid role.", success: false };
  }

  let user: Awaited<ReturnType<typeof requireTeamManage>>["user"];
  let admin: Awaited<ReturnType<typeof requireTeamManage>>["admin"];
  let userRole: Awaited<ReturnType<typeof requireTeamManage>>["userRole"];

  try {
    ({ user, admin, userRole } = await requireTeamManage());
  } catch (e) {
    return { error: (e as Error).message, success: false };
  }

  // Only owner can assign owner role; admin cannot elevate to owner
  if (newRole === "owner" && userRole.role !== "owner") {
    return { error: "Only the owner can assign the owner role.", success: false };
  }

  const { error } = await admin
    .from("user_roles")
    .update({ role: newRole } as never)
    .eq("user_id", targetUserId)
    .eq("business_id", userRole.businessId);

  if (error) return { error: error.message, success: false };

  await logSecurityEvent(admin, {
    type:     "team_role_changed",
    userId:   user.id,
    email:    user.email ?? undefined,
    metadata: { targetUserId, newRole, businessId: userRole.businessId },
  });

  return { error: null, success: true };
}

// ── Suspend / reinstate ───────────────────────────────────────────────────────

export async function suspendUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const targetUserId = formData.get("userId") as string;

  let user: Awaited<ReturnType<typeof requireTeamManage>>["user"];
  let admin: Awaited<ReturnType<typeof requireTeamManage>>["admin"];
  let userRole: Awaited<ReturnType<typeof requireTeamManage>>["userRole"];

  try {
    ({ user, admin, userRole } = await requireTeamManage());
  } catch (e) {
    return { error: (e as Error).message, success: false };
  }

  if (targetUserId === user.id) {
    return { error: "You cannot suspend yourself.", success: false };
  }

  const { error } = await admin
    .from("user_roles")
    .update({ status: "suspended" } as never)
    .eq("user_id", targetUserId)
    .eq("business_id", userRole.businessId);

  if (error) return { error: error.message, success: false };

  await logSecurityEvent(admin, {
    type:     "team_member_suspended",
    userId:   user.id,
    email:    user.email ?? undefined,
    metadata: { targetUserId, businessId: userRole.businessId },
  });

  return { error: null, success: true };
}

export async function reinstateUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const targetUserId = formData.get("userId") as string;

  let admin: Awaited<ReturnType<typeof requireTeamManage>>["admin"];
  let userRole: Awaited<ReturnType<typeof requireTeamManage>>["userRole"];

  try {
    ({ admin, userRole } = await requireTeamManage());
  } catch (e) {
    return { error: (e as Error).message, success: false };
  }

  const { error } = await admin
    .from("user_roles")
    .update({ status: "active" } as never)
    .eq("user_id", targetUserId)
    .eq("business_id", userRole.businessId);

  if (error) return { error: error.message, success: false };
  return { error: null, success: true };
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const targetUserId = formData.get("userId") as string;

  let user: Awaited<ReturnType<typeof requireTeamManage>>["user"];
  let admin: Awaited<ReturnType<typeof requireTeamManage>>["admin"];
  let userRole: Awaited<ReturnType<typeof requireTeamManage>>["userRole"];

  try {
    ({ user, admin, userRole } = await requireTeamManage());
  } catch (e) {
    return { error: (e as Error).message, success: false };
  }

  if (targetUserId === user.id) {
    return { error: "You cannot remove yourself.", success: false };
  }

  const { error } = await admin
    .from("user_roles")
    .update({ status: "removed" } as never)
    .eq("user_id", targetUserId)
    .eq("business_id", userRole.businessId);

  if (error) return { error: error.message, success: false };

  await logSecurityEvent(admin, {
    type:     "team_member_removed",
    userId:   user.id,
    email:    user.email ?? undefined,
    metadata: { targetUserId, businessId: userRole.businessId },
  });

  return { error: null, success: true };
}

// ── Revoke invitation ─────────────────────────────────────────────────────────

export async function revokeInvitationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const invitationId = formData.get("invitationId") as string;

  let admin: Awaited<ReturnType<typeof requireTeamManage>>["admin"];
  let userRole: Awaited<ReturnType<typeof requireTeamManage>>["userRole"];

  try {
    ({ admin, userRole } = await requireTeamManage());
  } catch (e) {
    return { error: (e as Error).message, success: false };
  }

  const { error } = await admin
    .from("invitations")
    .update({ status: "revoked" } as never)
    .eq("id", invitationId)
    .eq("business_id", userRole.businessId);

  if (error) return { error: error.message, success: false };
  return { error: null, success: true };
}
