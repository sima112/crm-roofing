/**
 * Data export for GDPR portability (Article 20).
 * Generates a ZIP containing JSON/CSV files of all user data.
 * SERVER ONLY.
 */

import "server-only";

// ─────────────────────────────────────────────────────────────────────────────
// CSV helpers
// ─────────────────────────────────────────────────────────────────────────────

function csvEscape(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines   = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Export builder
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportPayload {
  "account.json":          string;
  "customers.csv":         string;
  "jobs.csv":              string;
  "invoices.csv":          string;
  "consent_history.csv":   string;
  "security_events.csv":   string;
  "ai_conversations.json": string;
}

export async function buildUserDataExport(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  businessId: string
): Promise<ExportPayload> {
  // Fetch all data in parallel
  const [
    bizRes,
    customersRes,
    jobsRes,
    invoicesRes,
    consentsRes,
    eventsRes,
    aiRes,
  ] = await Promise.all([
    adminClient
      .from("businesses")
      .select("name, trade, phone, email, address, subscription_status, created_at")
      .eq("owner_id", userId)
      .single(),
    adminClient
      .from("customers")
      .select("id, name, phone, email, address, city, state, zip, tags, created_at")
      .eq("business_id", businessId),
    adminClient
      .from("jobs")
      .select("id, title, description, status, scheduled_date, completed_date, notes, created_at")
      .eq("business_id", businessId),
    adminClient
      .from("invoices")
      .select("id, invoice_number, status, amount, tax_amount, total, due_date, paid_date, notes, created_at")
      .eq("business_id", businessId),
    adminClient
      .from("consent_records")
      .select("consent_type, version, granted, granted_at, revoked_at, source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    adminClient
      .from("security_events")
      .select("event_type, email, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    adminClient
      .from("ai_conversations")
      .select("id, title, created_at, messages")
      .eq("user_id", userId),
  ]);

  const account = {
    user_id:             userId,
    business_name:       bizRes.data?.name,
    trade:               bizRes.data?.trade,
    phone:               bizRes.data?.phone,
    email:               bizRes.data?.email,
    subscription_status: bizRes.data?.subscription_status,
    account_created_at:  bizRes.data?.created_at,
    export_generated_at: new Date().toISOString(),
  };

  return {
    "account.json":          JSON.stringify(account, null, 2),
    "customers.csv":         toCsv((customersRes.data ?? []) as Record<string, unknown>[]),
    "jobs.csv":              toCsv((jobsRes.data ?? []) as Record<string, unknown>[]),
    "invoices.csv":          toCsv((invoicesRes.data ?? []) as Record<string, unknown>[]),
    "consent_history.csv":   toCsv((consentsRes.data ?? []) as Record<string, unknown>[]),
    "security_events.csv":   toCsv((eventsRes.data ?? []) as Record<string, unknown>[]),
    "ai_conversations.json": JSON.stringify(
      aiRes.data ?? [],
      null,
      2
    ),
  };
}

/**
 * Generate a ZIP buffer from the export payload using jszip.
 * Returns a Buffer suitable for a file download response.
 */
export async function buildZipBuffer(payload: ExportPayload): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip   = new JSZip();

  for (const [filename, content] of Object.entries(payload)) {
    zip.file(filename, content);
  }

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
  return Buffer.from(arrayBuffer);
}
