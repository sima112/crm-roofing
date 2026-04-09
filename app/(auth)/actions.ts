"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return "Email and password are required.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return error.message;

  redirect("/dashboard");
}

// ── Signup ───────────────────────────────────────────────────────────────────

export async function signupAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const fullName = formData.get("fullName") as string;
  const businessName = formData.get("businessName") as string;
  const trade = formData.get("trade") as string;
  const phone = formData.get("phone") as string;

  if (!email || !password || !fullName || !businessName || !trade)
    return "All required fields must be filled.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmPassword) return "Passwords do not match.";

  const admin = createAdminClient();

  // Use the admin auth API to create the user — this guarantees the user
  // row is committed to auth.users before we insert the business below.
  const { data: adminData, error: adminError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation for now; enable later
      user_metadata: { full_name: fullName },
    });

  if (adminError) return adminError.message;
  if (!adminData.user) return "Signup failed. Please try again.";

  const userId = adminData.user.id;

  // Insert the business row now that the user definitely exists
  const { error: bizError } = await admin.from("businesses").insert({
    owner_id: userId,
    name: businessName,
    trade: trade as import("@/types/database").Trade,
    phone: phone || null,
  } as never);

  if (bizError) return bizError.message;

  // Sign the user in on the SSR client so the session cookie is set
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    // Account created — redirect to login so they can sign in manually
    redirect("/login?message=account_created");
  }

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
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmPassword) return "Passwords do not match.";

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return error.message;

  redirect("/dashboard");
}
