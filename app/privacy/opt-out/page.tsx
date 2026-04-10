"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormStatus } from "react-dom";
import { optOutAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Processing…" : "Do Not Sell My Information"}
    </Button>
  );
}

export default function OptOutPage() {
  const [state, action] = useActionState(optOutAction, { error: null, success: false });

  return (
    <div className="min-h-screen bg-slate-50 p-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-sm mb-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-white" />
            </div>
            CrewBooks
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Do Not Sell or Share My Personal Information
          </h1>
          <p className="text-sm text-muted-foreground">
            As required by the California Consumer Privacy Act (CCPA), you have the right to opt out of
            the sale or sharing of your personal information.
          </p>
        </div>

        {state.success ? (
          <div className="rounded-xl border bg-card shadow-sm p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <h2 className="font-semibold">Opt-out recorded</h2>
            <p className="text-sm text-muted-foreground">
              You have been opted out of data sharing. This will take effect within{" "}
              <strong>15 business days</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Questions? Email{" "}
              <a href="mailto:privacy@crewbooks.app" className="text-primary underline">
                privacy@crewbooks.app
              </a>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>What &ldquo;sharing&rdquo; means in this context:</strong></p>
              <p>
                CrewBooks may pass data to connected services like QuickBooks or analytics providers
                when you opt into those features. This opt-out disables all such sharing.
              </p>
              <p className="text-muted-foreground/70">
                Note: We do <strong>not</strong> sell personal information in the traditional sense.
                This form satisfies the CCPA opt-out requirement nonetheless.
              </p>
            </div>

            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
                <p className="text-xs text-muted-foreground">
                  Enter the email associated with your CrewBooks account, or the email you provided to a
                  CrewBooks customer.
                </p>
              </div>

              {state.error && (
                <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{state.error}</p>
                </div>
              )}

              <SubmitButton />
            </form>

            <p className="text-xs text-center text-muted-foreground">
              See also:{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>{" "}
              ·{" "}
              <Link href="/privacy/request" className="text-primary underline">Submit a Privacy Request</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
