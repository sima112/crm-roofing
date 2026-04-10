"use client";

import { useState, useTransition, useActionState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertTriangle, Download, Loader2, CheckCircle2,
  XCircle, Shield, FileText, Trash2,
} from "lucide-react";
import { updateConsentAction, scheduleDeletionAction } from "./actions";
import type { ConsentRecord } from "@/lib/consent";
import type { DataSummary } from "@/lib/gdpr";

const OPTIONAL_CONSENTS: {
  type: string;
  label: string;
  description: string;
}[] = [
  { type: "marketing_emails",   label: "Marketing & product update emails",       description: "Occasional tips and feature announcements. Unsubscribe any time." },
  { type: "analytics_tracking", label: "Analytics & usage tracking",               description: "Helps improve the product. No PII shared with third parties." },
  { type: "sms_notifications",  label: "SMS reminders sent to your customers",     description: "Automated SMS for invoice and job reminders." },
  { type: "data_sharing",       label: "Data sharing with third-party integrations", description: "Required for QuickBooks sync and similar integrations." },
];

interface Props {
  user: { id: string; email: string; createdAt: string };
  business: { id: string; name: string; createdAt: string; accountStatus: string; deletionScheduledAt: string | null };
  consents: ConsentRecord[];
  summary: DataSummary;
}

export function DataPrivacyClient({ user, business, consents, summary }: Props) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // Build a lookup: type → record
  const consentMap = Object.fromEntries(consents.map((c) => [c.consent_type, c]));

  // Local optimistic state for toggles
  const [consentState, setConsentState] = useState<Record<string, boolean>>(
    Object.fromEntries(OPTIONAL_CONSENTS.map(({ type }) => [type, consentMap[type]?.granted ?? false]))
  );

  const handleToggle = (type: string) => {
    const newVal = !consentState[type];
    setConsentState((prev) => ({ ...prev, [type]: newVal }));
    startTransition(async () => {
      const { error } = await updateConsentAction(type as never, newVal);
      if (error) {
        setConsentState((prev) => ({ ...prev, [type]: !newVal })); // revert
        toast({ title: "Error", description: error, variant: "destructive" });
      } else {
        toast({ title: newVal ? "Consent granted" : "Consent revoked", description: `Updated: ${type.replace(/_/g, " ")}` });
      }
    });
  };

  // Data export
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/data-export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `crewbooks-data-${new Date().toISOString().split("T")[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: "Your data ZIP has been downloaded." });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Deletion form
  const [deletionError, deletionAction, isPending] = useActionState(scheduleDeletionAction, { error: null, success: false });

  const signupDate = new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data &amp; Privacy</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your data, privacy preferences, and account rights.
        </p>
      </div>

      <Tabs defaultValue="my-data" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="my-data"     className="text-sm">My Data</TabsTrigger>
          <TabsTrigger value="download"    className="text-sm">Download</TabsTrigger>
          <TabsTrigger value="preferences" className="text-sm">Preferences</TabsTrigger>
          <TabsTrigger value="delete"      className="text-sm text-destructive data-[state=active]:text-destructive">Delete Account</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: My Data ─────────────────────────────────────────────── */}
        <TabsContent value="my-data" className="mt-0 space-y-6 max-w-2xl">
          <section className="rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Account Info
            </h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
              <dt className="text-muted-foreground">Business</dt>
              <dd className="font-medium">{business.name}</dd>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{signupDate}</dd>
              <dt className="text-muted-foreground">Account status</dt>
              <dd>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  business.accountStatus === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {business.accountStatus === "pending_deletion" ? "Pending deletion" : "Active"}
                </span>
              </dd>
            </dl>
          </section>

          <section className="rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold text-sm">Business Data</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Customers", count: summary.customerCount },
                { label: "Jobs",      count: summary.jobCount },
                { label: "Invoices",  count: summary.invoiceCount },
                { label: "AI conversations", count: summary.aiConversations },
                { label: "Security events",  count: summary.securityEvents },
              ].map(({ label, count }) => (
                <div key={label} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold text-sm">Consent Records</h2>
            {consents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No consent records found.</p>
            ) : (
              <div className="space-y-2">
                {consents.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <div>
                      <span className="font-medium capitalize">{c.consent_type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground ml-2">({c.version})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.granted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {c.granted
                          ? c.granted_at ? new Date(c.granted_at).toLocaleDateString() : "Granted"
                          : c.revoked_at ? new Date(c.revoked_at).toLocaleDateString() : "Revoked"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ── Tab 2: Download My Data ────────────────────────────────────── */}
        <TabsContent value="download" className="mt-0 max-w-xl">
          <div className="rounded-xl border p-6 space-y-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Download My Data
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Export all your CrewBooks data as a ZIP file. Includes:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>account.json — profile &amp; settings</li>
                <li>customers.csv — all customer records</li>
                <li>jobs.csv — all job records</li>
                <li>invoices.csv — all invoice records</li>
                <li>consent_history.csv — your consent log</li>
                <li>security_events.csv — login history</li>
                <li>ai_conversations.json — CrewBot chat history</li>
              </ul>
            </div>
            <Separator />
            <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
              {exporting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating export…</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Download My Data</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              This download is logged for security purposes. Your right to data portability is protected
              under GDPR Article 20 and CCPA §1798.100.
            </p>
          </div>
        </TabsContent>

        {/* ── Tab 3: Manage Preferences ──────────────────────────────────── */}
        <TabsContent value="preferences" className="mt-0 max-w-xl space-y-4">
          <div className="rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-sm">Privacy Preferences</h2>
            <p className="text-xs text-muted-foreground">
              Changes take effect immediately. Required cookies (auth, security) cannot be disabled.
            </p>

            {OPTIONAL_CONSENTS.map(({ type, label, description }) => {
              const record  = consentMap[type];
              const lastChanged = record?.updated_at
                ? new Date(record.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;

              return (
                <div key={type} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    {lastChanged && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Last changed: {lastChanged}</p>
                    )}
                  </div>
                  <button
                    role="switch"
                    aria-checked={consentState[type]}
                    aria-label={label}
                    onClick={() => handleToggle(type)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      consentState[type] ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        consentState[type] ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}

            <div className="pt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
              <Link href="/terms"   className="underline hover:text-foreground">Terms of Service</Link>
              <Link href="/privacy/opt-out" className="underline hover:text-foreground">Do Not Sell My Data</Link>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 4: Delete Account ──────────────────────────────────────── */}
        <TabsContent value="delete" className="mt-0 max-w-xl">
          {business.accountStatus === "pending_deletion" ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-destructive">Deletion scheduled</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account is scheduled for deletion on{" "}
                    <strong>
                      {business.deletionScheduledAt
                        ? new Date(business.deletionScheduledAt).toDateString()
                        : "30 days from now"}
                    </strong>.
                    A cancellation link was sent to your email.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/30 p-6 space-y-5">
              <div className="flex items-start gap-2">
                <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-destructive">Delete Account</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account and all associated data will be permanently deleted after a{" "}
                    <strong>30-day grace period</strong>. During this time you can cancel.
                    After 30 days, deletion is irreversible.
                  </p>
                </div>
              </div>

              <div className="text-sm space-y-1.5">
                <p className="font-medium">What gets deleted:</p>
                <ul className="text-muted-foreground space-y-0.5 list-disc list-inside text-xs">
                  <li>Profile &amp; account settings</li>
                  <li>All customers, jobs, and invoices</li>
                  <li>Job photos &amp; attachments</li>
                  <li>AI conversation history</li>
                  <li>Consent records and preferences</li>
                </ul>
                <p className="font-medium mt-2">What gets retained (legally required):</p>
                <ul className="text-muted-foreground space-y-0.5 list-disc list-inside text-xs">
                  <li>Payment records — 7 years (IRS requirement)</li>
                  <li>Anonymized aggregate statistics (no PII)</li>
                </ul>
              </div>

              <Separator />

              <form action={deletionAction} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="confirmation" className="text-sm">
                    Type <span className="font-mono font-bold">DELETE MY ACCOUNT</span> to confirm
                  </Label>
                  <Input
                    id="confirmation"
                    name="confirmation"
                    placeholder="DELETE MY ACCOUNT"
                    className="font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delete-password" className="text-sm">Current password</Label>
                  <Input
                    id="delete-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {deletionError.error && (
                  <p className="text-sm text-destructive">{deletionError.error}</p>
                )}

                <Button variant="destructive" type="submit" disabled={isPending} className="w-full sm:w-auto">
                  {isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling deletion…</>
                  ) : (
                    "Schedule Account Deletion"
                  )}
                </Button>
              </form>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
