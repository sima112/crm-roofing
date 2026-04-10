import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab }       from "./profile-tab";
import { NotificationsTab } from "./notifications-tab";
import { BillingTab }       from "./billing-tab";
import { AccountTab }       from "./account-tab";
import { QuickBooksTab }    from "./quickbooks-tab";
import { LateFeesTab }      from "./late-fees-tab";
import {
  getBusinessProfileAction,
  getReminderSettingsAction,
  getLateFeeSettingsAction,
} from "./settings-actions";
import { qboConfigured } from "@/lib/quickbooks";
import { getUserConsents } from "@/lib/consent";
import { getDataSummary }  from "@/lib/gdpr";
import { DataPrivacyClient } from "./data-privacy/data-privacy-client";
import { SecurityClient }   from "./security/security-client";
import { getLoginHistory }  from "@/lib/session-security";
import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Settings — CrewBooks" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>;
}) {
  const params   = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [business, reminderSettings, lateFeeSettings] = await Promise.all([
    getBusinessProfileAction(),
    getReminderSettingsAction(),
    getLateFeeSettingsAction(),
  ]);

  // Data privacy tab data — select base columns first, gracefully handle
  // new columns added in migration 013 (account_status, deletion_scheduled_at)
  const { data: bizBase } = await admin
    .from("businesses")
    .select("id, name, created_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  // These columns only exist after migration 013 — default gracefully
  let accountStatus        = "active";
  let deletionScheduledAt: string | null = null;

  if (bizBase) {
    const { data: bizExt } = await admin
      .from("businesses")
      .select("account_status, deletion_scheduled_at")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (bizExt) {
      accountStatus       = (bizExt as { account_status?: string }).account_status ?? "active";
      deletionScheduledAt = (bizExt as { deletion_scheduled_at?: string | null }).deletion_scheduled_at ?? null;
    }
  }

  const bizFull = bizBase
    ? { ...bizBase, account_status: accountStatus, deletion_scheduled_at: deletionScheduledAt }
    : null;

  const fallbackSummary = { customerCount: 0, jobCount: 0, invoiceCount: 0, aiConversations: 0, securityEvents: 0, consentRecords: 0 };
  let privacyConsents: Awaited<ReturnType<typeof getUserConsents>> = [];
  let dataSummary = fallbackSummary;

  if (bizFull) {
    try {
      [privacyConsents, dataSummary] = await Promise.all([
        getUserConsents(admin, user.id),
        getDataSummary(admin, user.id, bizFull.id),
      ]);
    } catch {
      // Migration 011/013 not yet run — show tab with empty data
    }
  }

  if (!business) redirect("/login");

  // Security tab data
  const { data: mfaData } = await supabase.auth.mfa.listFactors();
  const totpFactor  = mfaData?.totp?.[0] ?? null;
  const mfaEnabled  = totpFactor?.status === "verified";
  const session     = (await supabase.auth.getSession()).data.session;

  let secLoginHistory: Awaited<ReturnType<typeof getLoginHistory>> = [];
  let secPasswordChangedAt: string | null = null;

  try {
    secLoginHistory = await getLoginHistory(admin, user.id, 20);
    const { data: biz015 } = await admin
      .from("businesses")
      .select("password_changed_at")
      .eq("owner_id", user.id)
      .maybeSingle();
    secPasswordChangedAt = (biz015 as { password_changed_at?: string | null } | null)?.password_changed_at ?? null;
  } catch { /* migration 015 not yet run */ }

  const validTabs  = ["profile", "notifications", "billing", "late-fees", "account", "quickbooks", "data-privacy", "security"];
  const defaultTab = validTabs.includes(params.tab ?? "") ? (params.tab ?? "profile") : "profile";

  // ── QBO status ──────────────────────────────────────────────────────────────
  type SyncLogEntry = {
    id: string; entity_type: string; direction: string;
    status: string; error_message: string | null; qbo_id: string | null; created_at: string;
  };

  let qboStatus = {
    connected:    false,
    connectedAt:  null as string | null,
    lastSyncAt:   null as string | null,
    realmId:      null as string | null,
    companyName:  null as string | null,
    syncSettings: { auto_sync_invoices: true, auto_sync_customers: true, pull_payments: true },
    syncLog:      [] as SyncLogEntry[],
    errorCount:   0,
  };

  if (qboConfigured) {
    const admin = createAdminClient();

    const { data: biz } = await admin
      .from("businesses")
      .select(`
        id, qbo_realm_id, qbo_sync_enabled, qbo_connected_at,
        qbo_last_sync_at, qbo_company_name, qbo_sync_settings
      `)
      .eq("owner_id", user.id)
      .single();

    if (biz) {
      const b = biz as {
        id: string;
        qbo_realm_id:      string | null;
        qbo_sync_enabled:  boolean;
        qbo_connected_at:  string | null;
        qbo_last_sync_at:  string | null;
        qbo_company_name:  string | null;
        qbo_sync_settings: { auto_sync_invoices?: boolean; auto_sync_customers?: boolean; pull_payments?: boolean } | null;
      };

      const connected = !!b.qbo_realm_id && b.qbo_sync_enabled;

      let syncLog: SyncLogEntry[] = [];
      let errorCount = 0;

      if (connected) {
        const { data: logs } = await admin
          .from("sync_log")
          .select("id, entity_type, direction, status, error_message, qbo_id, created_at")
          .eq("business_id", b.id)
          .order("created_at", { ascending: false })
          .limit(20);

        syncLog = (logs ?? []) as SyncLogEntry[];
        errorCount = syncLog.filter((l) => l.status === "error").length;
      }

      qboStatus = {
        connected,
        connectedAt:  b.qbo_connected_at,
        lastSyncAt:   b.qbo_last_sync_at,
        realmId:      b.qbo_realm_id,
        companyName:  b.qbo_company_name,
        syncSettings: {
          auto_sync_invoices:  b.qbo_sync_settings?.auto_sync_invoices  ?? true,
          auto_sync_customers: b.qbo_sync_settings?.auto_sync_customers ?? true,
          pull_payments:       b.qbo_sync_settings?.pull_payments       ?? true,
        },
        syncLog,
        errorCount,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your business profile, notifications, and account.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="profile"       className="text-sm">Business Profile</TabsTrigger>
          <TabsTrigger value="notifications" className="text-sm">Notifications</TabsTrigger>
          {qboConfigured && (
            <TabsTrigger value="quickbooks" className="text-sm">QuickBooks</TabsTrigger>
          )}
          <TabsTrigger value="late-fees" className="text-sm">Late Fees</TabsTrigger>
          <TabsTrigger value="billing"       className="text-sm">Billing</TabsTrigger>
          <TabsTrigger value="account"       className="text-sm">Account</TabsTrigger>
          <TabsTrigger value="data-privacy"  className="text-sm">Data &amp; Privacy</TabsTrigger>
          <TabsTrigger value="security"      className="text-sm">Security</TabsTrigger>
        </TabsList>

        {/* Team link — separate page */}
        <div className="flex">
          <Button variant="outline" size="sm" asChild className="text-sm gap-1.5">
            <Link href="/settings/team">
              <Users className="w-4 h-4" />
              Manage Team
            </Link>
          </Button>
        </div>

        <TabsContent value="profile" className="mt-0">
          <ProfileTab business={business} />
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <NotificationsTab
            initialSettings={reminderSettings}
            twilioConfigured={
              !!process.env.TWILIO_ACCOUNT_SID &&
              process.env.TWILIO_ACCOUNT_SID !== "your-sid" &&
              !!process.env.TWILIO_AUTH_TOKEN &&
              process.env.TWILIO_AUTH_TOKEN !== "your-token" &&
              !!process.env.TWILIO_PHONE_NUMBER &&
              process.env.TWILIO_PHONE_NUMBER !== "+1xxxxxxxxxx"
            }
          />
        </TabsContent>

        {qboConfigured && (
          <TabsContent value="quickbooks" className="mt-0">
            <QuickBooksTab
              status={qboStatus}
              justConnected={params.connected === "true"}
              errorCode={params.error ?? null}
            />
          </TabsContent>
        )}

        <TabsContent value="late-fees" className="mt-0">
          <LateFeesTab initialSettings={lateFeeSettings} />
        </TabsContent>

        <TabsContent value="billing" className="mt-0">
          <BillingTab business={business} />
        </TabsContent>

        <TabsContent value="account" className="mt-0">
          <AccountTab email={user.email ?? ""} />
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SecurityClient
            user={{ id: user.id, email: user.email ?? "" }}
            mfaEnabled={mfaEnabled}
            totpFactorId={totpFactor?.id ?? null}
            loginHistory={secLoginHistory}
            passwordChangedAt={secPasswordChangedAt}
            currentSessionId={session?.access_token?.slice(-8) ?? null}
          />
        </TabsContent>

        {bizFull && (
          <TabsContent value="data-privacy" className="mt-0">
            <DataPrivacyClient
              user={{ id: user.id, email: user.email ?? "", createdAt: user.created_at ?? "" }}
              business={{
                id: bizFull.id,
                name: bizFull.name,
                createdAt: bizFull.created_at,
                accountStatus: bizFull.account_status,
                deletionScheduledAt: bizFull.deletion_scheduled_at,
              }}
              consents={privacyConsents}
              summary={dataSummary}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
