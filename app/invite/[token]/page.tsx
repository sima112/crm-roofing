"use client";

import { useEffect, useState, useActionState } from "react";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import {
  getInvitationByToken,
  acceptExistingUserAction,
  acceptNewUserAction,
  type InvitationDetails,
  type InvitationLookupResult,
} from "./actions";

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin:      "bg-blue-100 text-blue-800",
    technician: "bg-orange-100 text-orange-800",
    viewer:     "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role] ?? "bg-muted text-muted-foreground"}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ── Form: existing user ───────────────────────────────────────────────────────

function ExistingUserForm({ token, invitation }: { token: string; invitation: InvitationDetails }) {
  const [state, formAction, pending] = useActionState(acceptExistingUserAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <p className="text-sm text-muted-foreground">
        You already have a CrewBooks account with <strong>{invitation.email}</strong>.
        Enter your password to join.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Your CrewBooks password"
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
        Join {invitation.businessName}
      </Button>
    </form>
  );
}

// ── Form: new user ────────────────────────────────────────────────────────────

function NewUserForm({ token, invitation }: { token: string; invitation: InvitationDetails }) {
  const [state, formAction, pending] = useActionState(acceptNewUserAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <p className="text-sm text-muted-foreground">
        Create your account to join <strong>{invitation.businessName}</strong>.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" placeholder="Jane Smith" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" placeholder="At least 8 characters" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repeat password" required />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
        Create account &amp; join
      </Button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [result, setResult] = useState<InvitationLookupResult | null>(null);

  useEffect(() => {
    getInvitationByToken(token).then(setResult);
  }, [token]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ERROR_MESSAGES: Record<string, string> = {
    not_found:        "This invitation link is invalid or has already been used.",
    expired:          "This invitation has expired. Please ask your team to send a new one.",
    already_accepted: "This invitation has already been accepted.",
    revoked:          "This invitation has been revoked.",
  };

  if (!result.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Invitation unavailable</h1>
          <p className="text-muted-foreground text-sm">{ERROR_MESSAGES[result.reason]}</p>
        </div>
      </div>
    );
  }

  const { invitation } = result;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
      <div className="max-w-md w-full bg-background rounded-2xl border shadow-sm p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">You&apos;re invited!</h1>
          <p className="text-muted-foreground text-sm">
            <strong>{invitation.inviterName}</strong> invited you to join{" "}
            <strong>{invitation.businessName}</strong> as a{" "}
            <RoleBadge role={invitation.role} />.
          </p>
        </div>

        <hr />

        {invitation.isExistingUser ? (
          <ExistingUserForm token={token} invitation={invitation} />
        ) : (
          <NewUserForm token={token} invitation={invitation} />
        )}

        <p className="text-center text-xs text-muted-foreground">
          By joining, you agree to CrewBooks&apos;{" "}
          <a href="/terms" className="underline">Terms of Service</a>.
        </p>
      </div>
    </div>
  );
}
