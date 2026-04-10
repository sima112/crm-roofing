import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserConsents } from "@/lib/consent";
import { getDataSummary } from "@/lib/gdpr";
import { DataPrivacyClient } from "./data-privacy-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data & Privacy — CrewBooks" };

export default async function DataPrivacyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: biz } = await admin
    .from("businesses")
    .select("id, name, created_at, account_status, deletion_scheduled_at")
    .eq("owner_id", user.id)
    .single();

  if (!biz) redirect("/login");

  const [consents, summary] = await Promise.all([
    getUserConsents(admin, user.id),
    getDataSummary(admin, user.id, biz.id),
  ]);

  return (
    <DataPrivacyClient
      user={{ id: user.id, email: user.email ?? "", createdAt: user.created_at ?? "" }}
      business={{ id: biz.id, name: biz.name, createdAt: biz.created_at, accountStatus: biz.account_status, deletionScheduledAt: biz.deletion_scheduled_at }}
      consents={consents}
      summary={summary}
    />
  );
}
