"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Shield, Smartphone, Monitor, Tablet, CheckCircle2,
  XCircle, AlertTriangle, Download, Loader2, LogOut, Key,
} from "lucide-react";
import {
  enrollMfaAction, verifyMfaEnrollAction, disableMfaAction,
  revokeOtherSessionsAction, downloadSecurityLogAction,
} from "./actions";
import type { LoginHistoryRow } from "@/lib/session-security";
import Link from "next/link";

interface SecurityClientProps {
  user: { id: string; email: string };
  mfaEnabled: boolean;
  totpFactorId: string | null;
  loginHistory: LoginHistoryRow[];
  passwordChangedAt: string | null;
  currentSessionId: string | null;
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile")  return <Smartphone className="w-4 h-4" />;
  if (type === "tablet")  return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

export function SecurityClient({
  user,
  mfaEnabled: initialMfaEnabled,
  totpFactorId: initialFactorId,
  loginHistory,
  passwordChangedAt,
  currentSessionId,
}: SecurityClientProps) {
  const router  = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // MFA state
  const [mfaEnabled, setMfaEnabled]   = useState(initialMfaEnabled);
  const [factorId, setFactorId]       = useState(initialFactorId);
  const [enrolling, setEnrolling]     = useState(false);
  const [qrCode, setQrCode]           = useState<string | null>(null);
  const [secret, setSecret]           = useState<string | null>(null);
  const [mfaCode, setMfaCode]         = useState("");
  const [mfaLoading, setMfaLoading]   = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  // Session state
  const [revoking, setRevoking] = useState(false);

  // Security log export
  const [exporting, setExporting] = useState(false);

  // ── MFA enrollment ─────────────────────────────────────────────────────────

  const startEnroll = async () => {
    setMfaLoading(true);
    const result = await enrollMfaAction();
    setMfaLoading(false);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    setQrCode(result.qrCode);
    setSecret(result.secret);
    setFactorId(result.factorId);
    setEnrolling(true);
  };

  const confirmEnroll = async () => {
    if (!factorId || mfaCode.length !== 6) return;
    setMfaLoading(true);
    const { error } = await verifyMfaEnrollAction(factorId, mfaCode);
    setMfaLoading(false);
    if (error) {
      toast({ title: "Invalid code", description: error, variant: "destructive" });
      return;
    }
    setMfaEnabled(true);
    setEnrolling(false);
    setQrCode(null);
    setMfaCode("");
    toast({ title: "Two-factor authentication enabled" });
    startTransition(() => router.refresh());
  };

  const handleDisableMfa = async () => {
    if (!factorId || disableCode.length !== 6) return;
    setMfaLoading(true);
    const { error } = await disableMfaAction(factorId, disableCode);
    setMfaLoading(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    setMfaEnabled(false);
    setFactorId(null);
    setDisableMode(false);
    setDisableCode("");
    toast({ title: "Two-factor authentication disabled" });
    startTransition(() => router.refresh());
  };

  // ── Sessions ───────────────────────────────────────────────────────────────

  const handleRevokeOthers = async () => {
    setRevoking(true);
    const { error } = await revokeOtherSessionsAction();
    setRevoking(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "All other sessions revoked" });
    }
  };

  // ── Security log export ────────────────────────────────────────────────────

  const handleExportLog = async () => {
    setExporting(true);
    const { csv, error } = await downloadSecurityLogAction();
    setExporting(false);
    if (error) {
      toast({ title: "Export failed", description: error, variant: "destructive" });
      return;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `crewbooks-security-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pwChangedDate = passwordChangedAt
    ? new Date(passwordChangedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Never recorded";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Security
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage two-factor authentication, active sessions, and your security log.
        </p>
      </div>

      {/* ── MFA ──────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Two-Factor Authentication (2FA)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use an authenticator app (Google Authenticator, Authy) for an extra layer of security.
            </p>
          </div>
          {mfaEnabled ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
              Enabled
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
              Disabled
            </span>
          )}
        </div>

        {!mfaEnabled && !enrolling && (
          <Button size="sm" onClick={startEnroll} disabled={mfaLoading}>
            {mfaLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Enable 2FA
          </Button>
        )}

        {enrolling && qrCode && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-medium">Scan this QR code with your authenticator app:</p>
            <Image src={qrCode} alt="MFA QR Code" width={180} height={180} className="rounded-lg border" />
            {secret && (
              <div>
                <p className="text-xs text-muted-foreground">Or enter this key manually:</p>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded block mt-1 break-all">
                  {secret}
                </code>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Enter the 6-digit code from your app to confirm:</Label>
              <div className="flex gap-2">
                <Input
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="font-mono w-32 text-center"
                  maxLength={6}
                />
                <Button size="sm" onClick={confirmEnroll} disabled={mfaCode.length !== 6 || mfaLoading}>
                  {mfaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEnrolling(false); setQrCode(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {mfaEnabled && !disableMode && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDisableMode(true)}
          >
            Disable 2FA
          </Button>
        )}

        {disableMode && (
          <div className="space-y-2 border rounded-lg p-4 bg-destructive/5">
            <p className="text-sm text-destructive font-medium">Enter your current 2FA code to disable:</p>
            <div className="flex gap-2">
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="font-mono w-32 text-center"
                maxLength={6}
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisableMfa}
                disabled={disableCode.length !== 6 || mfaLoading}
              >
                {mfaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDisableMode(false); setDisableCode(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ── Password ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Key className="w-4 h-4" />
          Password
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Last changed: <span className="font-medium">{pwChangedDate}</span></p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings?tab=account">Change Password</Link>
          </Button>
        </div>
      </section>

      {/* ── Sessions ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Active Sessions
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRevokeOthers}
            disabled={revoking}
            className="text-xs"
          >
            {revoking ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <LogOut className="w-3 h-3 mr-1.5" />}
            Log out all other devices
          </Button>
        </div>

        {/* Current session */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <Monitor className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Current session</p>
            <p className="text-xs text-muted-foreground">
              {user.email}
              {currentSessionId && <span className="ml-2 font-mono">…{currentSessionId}</span>}
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Active now
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Sessions expire after 30 days of inactivity. To manage all sessions, use the logout button above.
        </p>
      </section>

      {/* ── Recent security events ────────────────────────────────────────── */}
      <section className="rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Recent Login Activity
          </h3>
          <Button size="sm" variant="outline" onClick={handleExportLog} disabled={exporting} className="text-xs">
            {exporting ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Download className="w-3 h-3 mr-1.5" />}
            Export 90-day log
          </Button>
        </div>

        {loginHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No login history yet. Run migration 015 in Supabase to start tracking.
          </p>
        ) : (
          <div className="space-y-2">
            {loginHistory.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  entry.suspicious ? "border-yellow-300 bg-yellow-50" : ""
                }`}
              >
                <DeviceIcon type={entry.device_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {entry.browser ?? "Unknown browser"} · {entry.device_type ?? "Unknown device"}
                    </span>
                    {entry.suspicious && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Suspicious
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.city && entry.country ? `${entry.city}, ${entry.country}` : entry.ip_address ?? "Unknown location"}
                    {" · "}
                    {new Date(entry.created_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                {entry.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <p className="text-xs text-muted-foreground">
        Account: <span className="font-medium">{user.email}</span>
        {" · "}
        <Link href="/settings?tab=data-privacy" className="underline hover:text-foreground">
          View full security log
        </Link>
      </p>
    </div>
  );
}
