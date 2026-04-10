/**
 * Consent management utilities — SERVER ONLY.
 * Handles recording, querying, and versioning of GDPR/CCPA consent.
 */

import "server-only";

export type ConsentType =
  | "terms_of_service"
  | "privacy_policy"
  | "marketing_emails"
  | "analytics_tracking"
  | "sms_notifications"
  | "data_sharing";

export const CURRENT_POLICY_VERSIONS: Record<"privacy_policy" | "terms_of_service", string> = {
  privacy_policy:   "v1.0",
  terms_of_service: "v1.0",
};

export const REQUIRED_CONSENTS: ConsentType[] = ["terms_of_service", "privacy_policy"];

export const CONSENT_LABELS: Record<ConsentType, string> = {
  terms_of_service:   "Terms of Service",
  privacy_policy:     "Privacy Policy",
  marketing_emails:   "Marketing & product update emails",
  analytics_tracking: "Analytics & usage tracking",
  sms_notifications:  "SMS job reminders & notifications",
  data_sharing:       "Data sharing with third-party integrations",
};

export const CONSENT_DESCRIPTIONS: Record<ConsentType, string> = {
  terms_of_service:   "Required to use CrewBooks",
  privacy_policy:     "Required to use CrewBooks",
  marketing_emails:   "Occasional tips, feature announcements, and offers. Unsubscribe any time.",
  analytics_tracking: "Helps us improve the product. No personally identifiable data shared.",
  sms_notifications:  "Automated SMS reminders for jobs and invoices sent to your customers.",
  data_sharing:       "Allows CrewBooks to share data with connected services like QuickBooks.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Record consent
// ─────────────────────────────────────────────────────────────────────────────

export async function recordConsent(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  opts: {
    userId: string;
    businessId?: string;
    consentType: ConsentType;
    granted: boolean;
    version?: string;
    source?: "signup" | "settings" | "cookie-banner";
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  const version =
    opts.version ??
    (opts.consentType === "privacy_policy" || opts.consentType === "terms_of_service"
      ? CURRENT_POLICY_VERSIONS[opts.consentType as "privacy_policy" | "terms_of_service"]
      : "v1.0");

  // Upsert: update the existing record if it exists, otherwise insert
  const { data: existing } = await adminClient
    .from("consent_records")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("consent_type", opts.consentType)
    .maybeSingle();

  if (existing) {
    await adminClient
      .from("consent_records")
      .update({
        granted:     opts.granted,
        granted_at:  opts.granted ? new Date().toISOString() : null,
        revoked_at:  opts.granted ? null : new Date().toISOString(),
        version,
        source:      opts.source ?? "settings",
        ip_address:  opts.ipAddress ?? null,
        user_agent:  opts.userAgent ?? null,
        updated_at:  new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await adminClient.from("consent_records").insert({
      user_id:     opts.userId,
      business_id: opts.businessId ?? null,
      consent_type: opts.consentType,
      version,
      granted:     opts.granted,
      granted_at:  opts.granted ? new Date().toISOString() : null,
      revoked_at:  opts.granted ? null : new Date().toISOString(),
      source:      opts.source ?? "signup",
      ip_address:  opts.ipAddress ?? null,
      user_agent:  opts.userAgent ?? null,
    });
  }
}

/** Record multiple consents at once (e.g., at signup) */
export async function recordConsentBatch(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  opts: {
    userId: string;
    businessId?: string;
    consents: Partial<Record<ConsentType, boolean>>;
    source?: "signup" | "settings" | "cookie-banner";
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  for (const [type, granted] of Object.entries(opts.consents)) {
    if (granted === undefined) continue;
    await recordConsent(adminClient, {
      ...opts,
      consentType: type as ConsentType,
      granted: granted as boolean,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query consent
// ─────────────────────────────────────────────────────────────────────────────

export type ConsentRecord = {
  id: string;
  consent_type: string;
  version: string;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export async function getUserConsents(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string
): Promise<ConsentRecord[]> {
  const { data } = await adminClient
    .from("consent_records")
    .select("id, consent_type, version, granted, granted_at, revoked_at, source, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (data ?? []) as ConsentRecord[];
}

export async function hasConsent(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  consentType: ConsentType
): Promise<boolean> {
  const { data } = await adminClient
    .from("consent_records")
    .select("granted")
    .eq("user_id", userId)
    .eq("consent_type", consentType)
    .maybeSingle();

  return data?.granted === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if user needs to re-consent to a new policy version
// ─────────────────────────────────────────────────────────────────────────────

export async function needsReconsent(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string
): Promise<boolean> {
  // Check if there are any policy versions requiring reconsent that this user hasn't agreed to
  const { data: newVersions } = await adminClient
    .from("policy_versions")
    .select("policy_type, version")
    .eq("requires_reconsent", true);

  if (!newVersions?.length) return false;

  for (const pv of newVersions) {
    const { data: consent } = await adminClient
      .from("consent_records")
      .select("id")
      .eq("user_id", userId)
      .eq("consent_type", pv.policy_type)
      .eq("version", pv.version)
      .eq("granted", true)
      .maybeSingle();

    if (!consent) return true;
  }

  return false;
}
