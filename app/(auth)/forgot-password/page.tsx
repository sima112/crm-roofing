"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Wrench, AlertCircle, MailCheck } from "lucide-react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initial: ForgotPasswordState = { error: null, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send Reset Link"}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, initial);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          {state.success ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If an account exists for that email, a reset link is on its
                  way.
                </p>
              </div>
              <Link
                href="/login"
                className="text-sm text-primary hover:underline mt-2"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
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
          )}
        </div>

        {!state.success && (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
