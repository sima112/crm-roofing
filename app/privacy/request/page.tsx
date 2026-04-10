"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormStatus } from "react-dom";
import { submitPrivacyRequestAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Submitting…" : "Submit Request"}
    </Button>
  );
}

const REQUEST_TYPES = [
  { value: "access",      label: "Access — Get a copy of my personal data" },
  { value: "correction",  label: "Correction — Fix inaccurate data" },
  { value: "deletion",    label: "Deletion — Delete my personal data" },
  { value: "portability", label: "Portability — Export my data in a machine-readable format" },
  { value: "opt_out",     label: "Opt-Out — Stop selling or sharing my personal information" },
];

export default function PrivacyRequestPage() {
  const [state, action] = useActionState(submitPrivacyRequestAction, { error: null, success: false });

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
          <h1 className="text-2xl font-bold tracking-tight">Privacy Request</h1>
          <p className="text-sm text-muted-foreground">
            Submit a GDPR/CCPA data rights request. We respond within 30 days.
          </p>
        </div>

        {state.success ? (
          <div className="rounded-xl border bg-card shadow-sm p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <h2 className="font-semibold">Request received</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent an acknowledgment to your email. We will respond within{" "}
              <strong>30 days</strong>.
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
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" type="text" placeholder="Jane Smith" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="requestType">Request Type</Label>
                <select
                  id="requestType"
                  name="requestType"
                  required
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>Select request type…</option>
                  {REQUEST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  Additional details{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Describe your request in more detail…"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
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
              By submitting this form you agree to our{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
              No login required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
