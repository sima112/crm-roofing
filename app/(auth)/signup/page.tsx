"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Wrench, AlertCircle } from "lucide-react";
import { signupAction } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";
import { checkPasswordStrength } from "@/lib/password-validation";

const TRADES = [
  { value: "roofing",    label: "Roofing" },
  { value: "hvac",       label: "HVAC" },
  { value: "plumbing",   label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "landscaping",label: "Landscaping" },
  { value: "general",    label: "General Contractor" },
];

function SubmitButton({ passwordScore }: { passwordScore: number }) {
  const { pending } = useFormStatus();
  const weak = passwordScore < 3;
  return (
    <Button type="submit" className="w-full" disabled={pending || weak}>
      {pending ? "Creating account…" : weak && passwordScore > 0 ? "Password too weak" : "Create Account"}
    </Button>
  );
}

export default function SignupPage() {
  const [error, action] = useActionState(signupAction, null);
  const [password, setPassword] = useState("");
  const passwordScore = checkPasswordStrength(password).score;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Start your free trial
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up CrewBooks for your crew in minutes
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <form action={action} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Jake Torres"
                autoComplete="name"
                required
              />
            </div>

            {/* Email */}
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

            {/* Business Name */}
            <div className="space-y-1.5">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                name="businessName"
                type="text"
                placeholder="Austin Peak Roofing"
                required
              />
            </div>

            {/* Trade */}
            <div className="space-y-1.5">
              <Label htmlFor="trade">Trade</Label>
              <select
                id="trade"
                name="trade"
                required
                defaultValue=""
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>Select your trade…</option>
                {TRADES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                Phone{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(512) 555-0100"
                autoComplete="tel"
              />
            </div>

            {/* Password + strength meter */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordStrengthMeter password={password} showChecklist={password.length > 0} />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_tos"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="text-primary underline font-medium">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" className="text-primary underline font-medium">Privacy Policy</a>
                  {" "}<span className="text-destructive">*</span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_marketing"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  I&apos;d like to receive product updates and tips via email (optional)
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_sms"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  I agree to receive SMS job reminders (optional)
                </span>
              </label>
            </div>

            {error && (
              <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <SubmitButton passwordScore={passwordScore} />
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
