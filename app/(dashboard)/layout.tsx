import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileFAB } from "@/components/mobile-fab";
import { ChatButton } from "@/components/crewbot/chat-button";
import { PasswordRotationBanner } from "@/components/password-rotation-banner";
import { checkPasswordRotation } from "@/lib/password-security";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  const businessName = business?.name ?? "My Business";

  // Password rotation check (graceful — new column may not exist yet)
  let rotationStatus: Awaited<ReturnType<typeof checkPasswordRotation>> = { status: "ok" };
  try {
    const admin = createAdminClient();
    rotationStatus = await checkPasswordRotation(user.id, admin);
  } catch {
    // migration 014 not yet run
  }

  // Hard redirect to change-password if expired
  // (skip if already on settings page to avoid redirect loop)
  const isSettingsPath = false; // layout doesn't have access to pathname; banner handles it

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar businessName={businessName} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopNav businessName={businessName} userEmail={user.email} />
        {rotationStatus.status !== "ok" && (
          <PasswordRotationBanner
            status={rotationStatus.status}
            daysLeft={"daysLeft" in rotationStatus ? rotationStatus.daysLeft : undefined}
          />
        )}
        <InstallPrompt />
        <main className="flex-1 p-4 md:p-6 pb-24">{children}</main>
      </div>
      <MobileFAB />
      <ChatButton />
    </div>
  );
}
