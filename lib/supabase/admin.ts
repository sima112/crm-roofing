import { createClient } from "@supabase/supabase-js";

// Service-role client — server-side only, never import in client components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient() {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
