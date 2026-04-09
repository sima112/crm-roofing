import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab }      from "./profile-tab";
import { NotificationsTab } from "./notifications-tab";
import { BillingTab }      from "./billing-tab";
import { AccountTab }      from "./account-tab";
import { QuickBooksTab }   from "./quickbooks-tab";
import {
  getBusinessProfileAction,
  getReminderSettingsAction,
} from "./settings-actions";
import { qboConfigured } from "@/lib/quickbooks";

export const metadata: Metadata = { title: "Settings — CrewBooks" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [business, reminderSettings] = await Promise.all([
    getBusinessProfileAction(),
    getReminderSettingsAction(),
  ]);

  if (!business) redirect("/login");

  // Determine active tab — default to "profile", honour ?tab= from QBO callback
  const validTabs = ["profile", "notifications", "billing", "account", "quickbooks"];
  const defaultTab = validTabs.includes(params.tab ?? "") ? (params.tab ?? "profile") : "profile";

  // QBO connection status
  let qboStatus = {
    connected:   false,
    syncEnabled: false,
    connectedAt: null as string | null,
    lastSyncAt:  null as string | null,
    realmId:     null as string | null,
  };

  if (qboConfigured) {
    const admin = createAdminClient();
    const { data: biz } = await admin
      .from("businesses")
      .select("qbo_realm_id, qbo_sync_enabled, qbo_connected_at, qbo_last_sync_at")
      .eq("owner_id", user.id)
      .single();

    if (biz) {
      const bizData = biz as {
        qbo_realm_id: string | null;
        qbo_sync_enabled: boolean;
        qbo_connected_at: string | null;
        qbo_last_sync_at: string | null;
      };
      qboStatus = {
        connected:   !!bizData.qbo_realm_id && bizData.qbo_sync_enabled,
        syncEnabled: bizData.qbo_sync_enabled,
        connectedAt: bizData.qbo_connected_at,
        lastSyncAt:  bizData.qbo_last_sync_at,
        realmId:     bizData.qbo_realm_id,
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
          <TabsTrigger value="billing"       className="text-sm">Billing</TabsTrigger>
          <TabsTrigger value="account"       className="text-sm">Account</TabsTrigger>
        </TabsList>

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

        <TabsContent value="billing" className="mt-0">
          <BillingTab business={business} />
        </TabsContent>

        <TabsContent value="account" className="mt-0">
          <AccountTab email={user.email ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
