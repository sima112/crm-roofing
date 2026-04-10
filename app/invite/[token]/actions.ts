"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/password-security";
import { validatePasswordComplexity } from "@/lib/password-validation";
import crypto from "crypto";

export type InvitationDetails = {
  id:           string;
  email:        string;
  role:         string;
  businessId:   string;
  businessName: string;
  inviterName:  string;
  isExistingUser: boolean;
};

export type InvitationLookupResult =
  | { ok: true;  invitation: InvitationDetails }
  | { ok: false; reason: "not_found" | "expired" | "already_accepted" | "revoked" };

/** Look up an invitation by its raw URL token. */
export async function getInvitationByToken(token: string): Promise<InvitationLookupResult> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, email, role, business_id, invited_by, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!inv) return { ok: false, reason: "not_found" };

  if (inv.status === "accepted")  return { ok: false, reason: "already_accepted" };
  if (inv.status === "revoked")   return { ok: false, reason: "revoked" };
  if (new Date(inv.expires_at) < new Date()) return { ok: false, reason: "expired" };

  // Fetch business name
  const { data: biz } = await admin
    .from("businesses")
    .select("name")
    .eq("id", inv.business_id)
    .maybeSingle();

  // Fetch inviter name
  let inviterName = "Your team";
  try {
    const { data: { user: inviter } } = await admin.auth.admin.getUserById(inv.invited_by);
    inviterName = (inviter?.user_metadata?.full_name as string) || inviter?.email || "Your team";
  } catch { /* ignore */ }

  // Check if invited email already has a Supabase account
  let isExistingUser = false;
  try {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    isExistingUser = users.some((u) => u.email?.toLowerCase() === inv.email.toLowerCase());
  } catch { /* ignore */ }

  return {
    ok: true,
    invitation: {
      id:           inv.id,
      email:        inv.email,
      role:         inv.role,
      businessId:   inv.business_id,
      businessName: (biz as { name: string } | null)?.name ?? "this business",
      inviterName,
      isExistingUser,
    },
  };
}

// ── Accept: existing user (verifies their password) ──────────────────────────

export type AcceptState = { error: string | null };

export async function acceptExistingUserAction(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const token    = formData.get("token") as string;
  const password = formData.get("password") as string;

  if (!token || !password) return { error: "Missing fields." };

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, email, role, business_id, expires_at, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
    return { error: "This invitation is no longer valid." };
  }

  // Verify credentials
  const supabase = await createClient();
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email:    inv.email,
    password,
  });

  if (signInErr || !signInData.user) {
    return { error: "Incorrect password. Please try again." };
  }

  const userId = signInData.user.id;

  // Add user_role (upsert in case they were removed previously)
  const { error: roleErr } = await admin.from("user_roles").upsert({
    user_id:     userId,
    business_id: inv.business_id,
    role:        inv.role,
    status:      "active",
    granted_by:  null,
    granted_at:  new Date().toISOString(),
  } as never, { onConflict: "user_id,business_id" });

  if (roleErr) return { error: roleErr.message };

  // Mark invitation accepted
  await admin.from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() } as never)
    .eq("id", inv.id);

  await logSecurityEvent(admin, {
    type:     "invitation_accepted",
    userId,
    email:    inv.email,
    metadata: { role: inv.role, businessId: inv.business_id },
  });

  redirect("/dashboard");
}

// ── Accept: new user (creates account) ───────────────────────────────────────

export async function acceptNewUserAction(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const token          = formData.get("token") as string;
  const fullName       = (formData.get("fullName") as string)?.trim();
  const password       = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !fullName || !password) return { error: "All fields are required." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const complexityErrors = validatePasswordComplexity(password);
  if (complexityErrors.length > 0) return { error: complexityErrors[0] };

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, email, role, business_id, expires_at, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
    return { error: "This invitation is no longer valid." };
  }

  // Create Supabase user
  const { data: newUserData, error: createErr } = await admin.auth.admin.createUser({
    email:         inv.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !newUserData.user) {
    return { error: createErr?.message ?? "Failed to create account." };
  }

  const userId = newUserData.user.id;

  // Add user_role
  const { error: roleErr } = await admin.from("user_roles").insert({
    user_id:     userId,
    business_id: inv.business_id,
    role:        inv.role,
    status:      "active",
  } as never);

  if (roleErr) return { error: roleErr.message };

  // Mark invitation accepted
  await admin.from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() } as never)
    .eq("id", inv.id);

  await logSecurityEvent(admin, {
    type:     "invitation_accepted",
    userId,
    email:    inv.email,
    metadata: { role: inv.role, businessId: inv.business_id, newUser: true },
  });

  // Sign in the new user
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: inv.email, password });

  redirect("/dashboard");
}
