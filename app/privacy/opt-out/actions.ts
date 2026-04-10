"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

export type OptOutState = { error: string | null; success: boolean };

export async function optOutAction(
  _prevState: OptOutState,
  formData: FormData
): Promise<OptOutState> {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Email is required.", success: false };

  const hdrs = await headers();
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const admin = createAdminClient();

  // Look up user by email (may not exist if it's a customer's email)
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const matchUser = authUsers?.users?.find((u) => u.email === email);

  if (matchUser) {
    // Record opt-out in consent_records for logged-in users
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", matchUser.id)
      .maybeSingle();

    await admin.from("consent_records").upsert({
      user_id:     matchUser.id,
      business_id: biz?.id ?? null,
      consent_type: "data_sharing",
      version:     "v1.0",
      granted:     false,
      granted_at:  null,
      revoked_at:  new Date().toISOString(),
      source:      "cookie-banner",
      ip_address:  ipAddress,
      updated_at:  new Date().toISOString(),
    }, { onConflict: "user_id,consent_type" });
  } else {
    // Store as a privacy request for non-users
    await admin.from("privacy_requests").insert({
      full_name:    email,
      email,
      request_type: "opt_out",
      notes:        "CCPA Do Not Sell opt-out via /privacy/opt-out form",
      ip_address:   ipAddress,
      acknowledged: false,
    });
  }

  return { error: null, success: true };
}
