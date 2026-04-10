import { redirect } from "next/navigation";
import Link from "next/link";
import { Wrench, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelAccountDeletion } from "@/lib/gdpr";

export default async function CancelDeletionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token) redirect("/");

  const admin   = createAdminClient();
  const success = await cancelAccountDeletion(admin, token);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-sm">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center mx-auto">
            <Wrench className="w-3.5 h-3.5 text-white" />
          </div>
          CrewBooks
        </Link>

        <div className="rounded-xl border bg-card shadow-sm p-8 space-y-4">
          {success ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h1 className="text-xl font-bold">Deletion cancelled</h1>
              <p className="text-sm text-muted-foreground">
                Your account deletion has been cancelled. Your account and all your data remain intact.
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Link expired or invalid</h1>
              <p className="text-sm text-muted-foreground">
                This cancellation link has expired, already been used, or is invalid.
              </p>
              <p className="text-xs text-muted-foreground">
                If you need help, contact{" "}
                <a href="mailto:support@crewbooks.app" className="text-primary underline">
                  support@crewbooks.app
                </a>
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
