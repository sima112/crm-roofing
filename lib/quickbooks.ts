/**
 * lib/quickbooks.ts
 * QuickBooks Online OAuth + API helpers.
 * All functions are server-only (never imported by client components).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const OAuthClient = require("intuit-oauth") as {
  new (opts: {
    clientId: string;
    clientSecret: string;
    environment: string;
    redirectUri: string;
    logging?: boolean;
  }): QBOAuthClient;
  scopes: { Accounting: string };
};

interface QBOToken {
  access_token: string;
  refresh_token: string;
  realmId?: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
}

interface QBOAuthClient {
  authorizeUri(opts: { scope: string[]; state: string }): string;
  createToken(url: string): Promise<{ getJson(): QBOToken }>;
  setToken(data: Partial<QBOToken>): void;
  getToken(): { getJson(): QBOToken };
  refresh(): Promise<{ getJson(): QBOToken }>;
  revoke(opts: { token: string }): Promise<void>;
}

import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const QBO_CLIENT_ID     = process.env.QBO_CLIENT_ID     ?? "";
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET ?? "";
const QBO_ENVIRONMENT   = (process.env.QBO_ENVIRONMENT ?? "sandbox") as "sandbox" | "production";
const QBO_REDIRECT_URI  =
  process.env.QBO_REDIRECT_URI ??
  `${process.env.NEXT_PUBLIC_APP_URL}/api/quickbooks/callback`;

/** True when all required env vars are present. Use to hide QBO UI when unconfigured. */
export const qboConfigured = !!(QBO_CLIENT_ID && QBO_CLIENT_SECRET);

const QBO_BASE_URL =
  QBO_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com/v3/company"
    : "https://sandbox-quickbooks.api.intuit.com/v3/company";

// ─────────────────────────────────────────────────────────────────────────────
// OAuth helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeClient(): QBOAuthClient {
  return new OAuthClient({
    clientId:     QBO_CLIENT_ID,
    clientSecret: QBO_CLIENT_SECRET,
    environment:  QBO_ENVIRONMENT,
    redirectUri:  QBO_REDIRECT_URI,
    logging:      false,
  });
}

/** Returns the QBO authorization URL to redirect the user to. */
export function getAuthUri(state: string): string {
  return makeClient().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  });
}

/** Exchanges the OAuth callback URL for tokens. */
export async function exchangeCode(callbackUrl: string): Promise<{
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: Date;
}> {
  const client = makeClient();
  const response = await client.createToken(callbackUrl);
  const token = response.getJson();
  return {
    accessToken:  token.access_token,
    refreshToken: token.refresh_token,
    realmId:      token.realmId ?? "",
    expiresAt:    new Date(Date.now() + token.expires_in * 1000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refreshes the access token for a business using its stored refresh token.
 * On failure, marks qbo_sync_enabled = false so the user is prompted to reconnect.
 */
export async function refreshTokens(
  businessId: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("qbo_refresh_token, qbo_realm_id")
    .eq("id", businessId)
    .single();

  if (!(biz as { qbo_refresh_token?: string })?.qbo_refresh_token) return null;

  const bizData = biz as { qbo_refresh_token: string; qbo_realm_id: string };
  const client = makeClient();
  client.setToken({
    refresh_token: bizData.qbo_refresh_token,
    realmId:       bizData.qbo_realm_id,
  });

  try {
    const response = await client.refresh();
    const token    = response.getJson();
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    await admin
      .from("businesses")
      .update({
        qbo_access_token:     token.access_token,
        qbo_refresh_token:    token.refresh_token ?? bizData.qbo_refresh_token,
        qbo_token_expires_at: expiresAt.toISOString(),
      })
      .eq("id", businessId);

    return { accessToken: token.access_token, expiresAt };
  } catch {
    // Refresh token expired or revoked — require reconnect
    await admin
      .from("businesses")
      .update({ qbo_sync_enabled: false })
      .eq("id", businessId);
    return null;
  }
}

/**
 * Returns a valid access token, refreshing if necessary.
 * Returns null if the business is not connected or refresh fails.
 */
export async function getValidAccessToken(
  businessId: string
): Promise<{ accessToken: string; realmId: string } | null> {
  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select(
      "qbo_access_token, qbo_refresh_token, qbo_token_expires_at, qbo_realm_id, qbo_sync_enabled"
    )
    .eq("id", businessId)
    .single();

  const bizData = biz as {
    qbo_access_token: string | null;
    qbo_refresh_token: string | null;
    qbo_token_expires_at: string | null;
    qbo_realm_id: string | null;
    qbo_sync_enabled: boolean;
  } | null;

  if (!bizData?.qbo_sync_enabled || !bizData.qbo_realm_id) return null;

  const expiresAt  = bizData.qbo_token_expires_at ? new Date(bizData.qbo_token_expires_at) : null;
  const isExpiring = !expiresAt || expiresAt <= new Date(Date.now() + 5 * 60 * 1000); // 5-min buffer

  if (isExpiring) {
    const refreshed = await refreshTokens(businessId);
    if (!refreshed) return null;
    return { accessToken: refreshed.accessToken, realmId: bizData.qbo_realm_id };
  }

  return { accessToken: bizData.qbo_access_token!, realmId: bizData.qbo_realm_id };
}

// ─────────────────────────────────────────────────────────────────────────────
// API wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Makes an authenticated QBO API call, auto-refreshing the token if needed.
 * Throws on auth failure (disconnects) or API errors.
 */
export async function makeApiCall(
  businessId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<unknown> {
  const tokens = await getValidAccessToken(businessId);
  if (!tokens) throw new Error("QuickBooks not connected");

  const { accessToken, realmId } = tokens;
  const url = `${QBO_BASE_URL}/${realmId}/${endpoint}?minorversion=65`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      Accept:         "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Token revoked on QBO side — mark as disconnected
    const admin = createAdminClient();
    await admin
      .from("businesses")
      .update({ qbo_sync_enabled: false })
      .eq("id", businessId);
    throw new Error("QuickBooks authorization expired — please reconnect");
  }

  if (!res.ok) {
    const text = await res.text();
    // Parse QBO fault format if possible
    try {
      const json = JSON.parse(text) as { Fault?: { Error?: { Message: string }[] } };
      const msg  = json.Fault?.Error?.[0]?.Message ?? text;
      throw new Error(`QBO API error: ${msg}`);
    } catch {
      throw new Error(`QBO API error ${res.status}: ${text}`);
    }
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Disconnect
// ─────────────────────────────────────────────────────────────────────────────

/** Revokes tokens on QBO side and clears all QBO fields in the database. */
export async function revokeTokens(businessId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("qbo_refresh_token")
    .eq("id", businessId)
    .single();

  const bizData = biz as { qbo_refresh_token?: string } | null;

  if (bizData?.qbo_refresh_token) {
    const client = makeClient();
    client.setToken({ refresh_token: bizData.qbo_refresh_token });
    try {
      await client.revoke({ token: bizData.qbo_refresh_token });
    } catch {
      // Ignore — clear locally regardless
    }
  }

  await admin
    .from("businesses")
    .update({
      qbo_realm_id:         null,
      qbo_access_token:     null,
      qbo_refresh_token:    null,
      qbo_token_expires_at: null,
      qbo_connected_at:     null,
      qbo_sync_enabled:     false,
      qbo_last_sync_at:     null,
    })
    .eq("id", businessId);
}
