import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileFAB } from "@/components/mobile-fab";

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar businessName={businessName} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopNav businessName={businessName} userEmail={user.email} />
        <InstallPrompt />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>
      <MobileFAB />
    </div>
  );
}
