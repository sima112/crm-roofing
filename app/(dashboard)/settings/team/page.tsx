import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/permissions";
import { getTeamDataAction } from "./actions";
import { TeamClient } from "./team-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Team — CrewBooks" };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const userRole = await getUserRole(admin, user.id);

  if (!userRole || !["owner", "admin"].includes(userRole.role)) {
    redirect("/settings");
  }

  let teamData = {
    members:      [] as Awaited<ReturnType<typeof getTeamDataAction>>["members"],
    invites:      [] as Awaited<ReturnType<typeof getTeamDataAction>>["invites"],
    seatUsed:     1,
    seatLimit:    3,
    businessName: "",
  };

  try {
    teamData = await getTeamDataAction();
  } catch {
    // migration 016 not yet run — show empty state
  }

  return (
    <TeamClient
      initialData={teamData}
      currentUserId={user.id}
      currentUserRole={userRole.role}
    />
  );
}
