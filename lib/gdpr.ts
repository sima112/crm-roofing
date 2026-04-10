/**
 * GDPR/CCPA data rights utilities — SERVER ONLY.
 * Handles account deletion scheduling, cancellation, and data summary.
 */

import "server-only";
import crypto from "crypto";
import { logSecurityEvent } from "@/lib/password-security";

// ─────────────────────────────────────────────────────────────────────────────
// Account deletion (30-day grace period)
// ─────────────────────────────────────────────────────────────────────────────

/** Schedule account for deletion in 30 days. Returns cancel token. */
export async function scheduleAccountDeletion(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string
): Promise<{ cancelToken: string; deletionDate: Date }> {
  const cancelToken   = crypto.randomBytes(32).toString("hex");
  const deletionDate  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await adminClient
    .from("businesses")
    .update({
      account_status:        "pending_deletion",
      deletion_scheduled_at: deletionDate.toISOString(),
      deletion_cancel_token: cancelToken,
    })
    .eq("owner_id", userId);

  await logSecurityEvent(adminClient, {
    type: "account_locked",
    userId,
    metadata: { action: "deletion_scheduled", deletion_date: deletionDate.toISOString() },
  });

  return { cancelToken, deletionDate };
}

/** Cancel a pending deletion using the token. Returns success boolean. */
export async function cancelAccountDeletion(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  cancelToken: string
): Promise<boolean> {
  const { data } = await adminClient
    .from("businesses")
    .select("owner_id")
    .eq("deletion_cancel_token", cancelToken)
    .eq("account_status", "pending_deletion")
    .maybeSingle();

  if (!data) return false;

  await adminClient
    .from("businesses")
    .update({
      account_status:        "active",
      deletion_scheduled_at: null,
      deletion_cancel_token: null,
    })
    .eq("deletion_cancel_token", cancelToken);

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data summary (for "My Data" tab)
// ─────────────────────────────────────────────────────────────────────────────

export type DataSummary = {
  customerCount:     number;
  jobCount:          number;
  invoiceCount:      number;
  aiConversations:   number;
  securityEvents:    number;
  consentRecords:    number;
};

export async function getDataSummary(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  businessId: string
): Promise<DataSummary> {
  const [customers, jobs, invoices, aiConvos, secEvents, consents] = await Promise.all([
    adminClient.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    adminClient.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    adminClient.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    adminClient.from("ai_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("security_events").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("consent_records").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    customerCount:   customers.count ?? 0,
    jobCount:        jobs.count ?? 0,
    invoiceCount:    invoices.count ?? 0,
    aiConversations: aiConvos.count ?? 0,
    securityEvents:  secEvents.count ?? 0,
    consentRecords:  consents.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy requests
// ─────────────────────────────────────────────────────────────────────────────

export type PrivacyRequestType = "access" | "correction" | "deletion" | "portability" | "opt_out";

export async function submitPrivacyRequest(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  req: {
    fullName:    string;
    email:       string;
    requestType: PrivacyRequestType;
    notes?:      string;
    ipAddress?:  string;
  }
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from("privacy_requests")
    .insert({
      full_name:    req.fullName,
      email:        req.email,
      request_type: req.requestType,
      notes:        req.notes ?? null,
      ip_address:   req.ipAddress ?? null,
      acknowledged: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string };
}
