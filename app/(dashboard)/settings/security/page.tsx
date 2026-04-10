import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginHistory } from "@/lib/session-security";
import { SecurityClient } from "./security-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security — CrewBooks" };

export default async function SecurityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // MFA factors
  const { data: mfaData } = await supabase.auth.mfa.listFactors();
  const totpFactor = mfaData?.totp?.[0] ?? null;
  const mfaEnabled = totpFactor?.status === "verified";

  // Login history — graceful if migration 015 not yet run
  let loginHistory: Awaited<ReturnType<typeof getLoginHistory>> = [];
  let passwordChangedAt: string | null = null;

  try {
    loginHistory = await getLoginHistory(admin, user.id, 20);

    const { data: biz } = await admin
      .from("businesses")
      .select("password_changed_at")
      .eq("owner_id", user.id)
      .maybeSingle();

    passwordChangedAt = (biz as { password_changed_at?: string | null } | null)?.password_changed_at ?? null;
  } catch { /* migration not yet run */ }

  // Active Supabase sessions — not directly queryable via client,
  // so we show the current session token info as a proxy
  const session = (await supabase.auth.getSession()).data.session;

  return (
    <SecurityClient
      user={{ id: user.id, email: user.email ?? "" }}
      mfaEnabled={mfaEnabled}
      totpFactorId={totpFactor?.id ?? null}
      loginHistory={loginHistory}
      passwordChangedAt={passwordChangedAt}
      currentSessionId={session?.access_token?.slice(-8) ?? null}
    />
  );
}
