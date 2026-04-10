"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validatePasswordComplexity,
  checkPasswordBreached,
  recordPasswordHistory,
  isPasswordReused,
  logSecurityEvent,
  isForgotPasswordRateLimited,
  stampPasswordChangedAt,
} from "@/lib/password-security";
import { recordConsentBatch } from "@/lib/consent";
import { headers } from "next/headers";
import {
  checkLockout,
  recordLoginAttempt,
  detectSuspiciousLogin,
  getGeoInfo,
} from "@/lib/session-security";

// ── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email    = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return "Email and password are required.";

  const admin = createAdminClient();
  const hdrs  = await headers();
  const ip    = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? undefined;
  const ua    = hdrs.get("user-agent") ?? undefined;

  // ── Brute-force lockout check ─────────────────────────────────────────────
  // Graceful: skip if migration 015 not yet run
  let lockout: Awaited<ReturnType<typeof checkLockout>> = { locked: false };
  try {
    lockout = await checkLockout(admin, email);
  } catch { /* migration not yet run */ }

  if (lockout.locked && lockout.lockedUntil) {
    const time = lockout.lockedUntil.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `Too many failed attempts. Account locked until ${time}. Check your email for details.`;
  }

  // ── Attempt sign-in ───────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  // Geo lookup (non-blocking — run in background of the request)
  const geo = await getGeoInfo(ip ?? "").catch(() => null);

  if (error) {
    // Log failed attempt
    try {
      await recordLoginAttempt(admin, { email, success: false, ip, userAgent: ua, geo });
    } catch { /* migration not yet run */ }
    return error.message;
  }

  const userId = signInData.user?.id;

  // ── Log success + suspicious detection ───────────────────────────────────
  try {
    const suspicious = userId
      ? await detectSuspiciousLogin(admin, { userId, email, ip, userAgent: ua, geo })
      : false;

    await recordLoginAttempt(admin, {
      userId,
      email,
      success:   true,
      ip,
      userAgent: ua,
      geo,
      suspicious,
    });
  } catch { /* migration not yet run */ }

  redirect("/dashboard");
}

// ── Signup ───────────────────────────────────────────────────────────────────

export async function signupAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email           = formData.get("email") as string;
  const password        = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const fullName        = formData.get("fullName") as string;
  const businessName    = formData.get("businessName") as string;
  const trade           = formData.get("trade") as string;
  const phone           = formData.get("phone") as string;
  const consentTos      = formData.get("consent_tos") === "on";
  const consentMarketing = formData.get("consent_marketing") === "on";
  const consentSms      = formData.get("consent_sms") === "on";

  if (!email || !password || !fullName || !businessName || !trade)
    return "All required fields must be filled.";

  if (!consentTos)
    return "You must agree to the Terms of Service and Privacy Policy to create an account.";

  if (password !== confirmPassword) return "Passwords do not match.";

  // Complexity validation
  const complexityErrors = validatePasswordComplexity(password, { email, businessName });
  if (complexityErrors.length > 0) return complexityErrors[0];

  // HIBP breach check
  const breached = await checkPasswordBreached(password);
  if (breached) {
    return "This password has appeared in a data breach. Please choose a different password.";
  }

  const admin = createAdminClient();

  const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (adminError) return adminError.message;
  if (!adminData.user) return "Signup failed. Please try again.";

  const userId = adminData.user.id;

  // Record initial password in history
  await recordPasswordHistory(userId, password, admin);

  // Record consents
  const hdrs = await headers();
  const ipAddress  = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? undefined;
  const userAgent  = hdrs.get("user-agent") ?? undefined;

  await recordConsentBatch(admin, {
    userId,
    consents: {
      terms_of_service:   consentTos,
      privacy_policy:     consentTos,
      marketing_emails:   consentMarketing,
      sms_notifications:  consentSms,
    },
    source: "signup",
    ipAddress,
    userAgent,
  });

  // Log signup event
  await logSecurityEvent(admin, { type: "signup", userId, email });

  const { error: bizError } = await admin.from("businesses").insert({
    owner_id: userId,
    name:     businessName,
    trade:    trade as import("@/types/database").Trade,
    phone:    phone || null,
  } as never);

  if (bizError) return bizError.message;

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) redirect("/login?message=account_created");

  redirect("/dashboard");
}

// ── Forgot password ───────────────────────────────────────────────────────────

export type ForgotPasswordState = { error: string | null; success: boolean };

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get("email") as string;
  if (!email) return { error: "Email is required.", success: false };

  const admin = createAdminClient();

  // Rate limit: 3 requests per email per hour
  const limited = await isForgotPasswordRateLimited(email, admin);
  if (limited) {
    return {
      error: "Too many password reset requests. Please wait an hour before trying again.",
      success: false,
    };
  }

  // Log the attempt (before sending, so even failed sends are counted)
  await logSecurityEvent(admin, { type: "password_reset_requested", email });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message, success: false };
  return { error: null, success: true };
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const password        = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) return "Passwords do not match.";

  const complexityErrors = validatePasswordComplexity(password);
  if (complexityErrors.length > 0) return complexityErrors[0];

  const breached = await checkPasswordBreached(password);
  if (breached) {
    return "This password has appeared in a data breach. Please choose a different one.";
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const reused = await isPasswordReused(user.id, password, admin);
    if (reused) {
      return "You have used this password recently. Please choose a different password.";
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return error.message;

  if (user) {
    const admin = createAdminClient();
    await recordPasswordHistory(user.id, password, admin);
    await stampPasswordChangedAt(user.id, admin);
    await logSecurityEvent(admin, {
      type: "password_changed",
      userId: user.id,
      email:  user.email,
    });
  }

  redirect("/dashboard");
}
