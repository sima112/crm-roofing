import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./profile-tab";
import { NotificationsTab } from "./notifications-tab";
import { BillingTab } from "./billing-tab";
import { AccountTab } from "./account-tab";
import {
  getBusinessProfileAction,
  getReminderSettingsAction,
} from "./settings-actions";

export const metadata: Metadata = { title: "Settings — CrewBooks" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [business, reminderSettings] = await Promise.all([
    getBusinessProfileAction(),
    getReminderSettingsAction(),
  ]);

  if (!business) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your business profile, notifications, and account.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="profile" className="text-sm">Business Profile</TabsTrigger>
          <TabsTrigger value="notifications" className="text-sm">Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="text-sm">Billing</TabsTrigger>
          <TabsTrigger value="account" className="text-sm">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <ProfileTab business={business} />
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <NotificationsTab initialSettings={reminderSettings} />
        </TabsContent>

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
