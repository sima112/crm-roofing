"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw,
  Unplug, ArrowRight, ArrowLeft, AlertTriangle, Clock, RotateCcw,
  Users, FileText, CreditCard,
} from "lucide-react";
import { saveQBOSyncSettingsAction, type QBOSyncSettings } from "./settings-actions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SyncLogEntry {
  id:            string;
  entity_type:   string;
  direction:     string;
  status:        string;
  error_message: string | null;
  qbo_id:        string | null;
  created_at:    string;
}

interface QBOStatus {
  connected:    boolean;
  connectedAt:  string | null;
  lastSyncAt:   string | null;
  realmId:      string | null;
  companyName:  string | null;
  syncSettings: QBOSyncSettings;
  syncLog:      SyncLogEntry[];
  errorCount:   number;
}

interface QuickBooksTabProps {
  status:        QBOStatus;
  justConnected: boolean;
  errorCode:     string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  access_denied:         "You cancelled the QuickBooks authorization.",
  invalid_callback:      "Invalid callback from QuickBooks. Please try again.",
  state_mismatch:        "Security check failed. Please try again.",
  token_exchange_failed: "Failed to exchange authorization code. Please try again.",
  not_configured:        "QuickBooks credentials are not configured on this server.",
  invalid_state:         "Invalid authorization state. Please try again.",
};

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Not-connected view
// ─────────────────────────────────────────────────────────────────────────────

function NotConnectedView({ errorCode }: { errorCode: string | null }) {
  return (
    <div className="space-y-6 max-w-2xl">
      {errorCode && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <XCircle className="w-4 h-4 shrink-0" />
          {ERROR_MESSAGES[errorCode] ?? "An error occurred. Please try again."}
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Green accent top bar */}
        <div className="h-1.5 bg-[#2CA01C]" />
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#2CA01C] flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white font-extrabold text-base tracking-tight">QB</span>
            </div>
            <div>
              <CardTitle className="text-lg">Connect QuickBooks Online</CardTitle>
              <CardDescription className="mt-0.5">
                Automatically sync your invoices and customer data with QuickBooks. Your accountant will love you.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits */}
          <ul className="space-y-3">
            {[
              { icon: FileText, text: "Invoices sync automatically — create in CrewBooks, appears in QuickBooks" },
              { icon: Users,    text: "Customer records stay in sync across both platforms" },
              { icon: CreditCard, text: "Payments recorded in QuickBooks auto-update your CrewBooks invoices" },
              { icon: CheckCircle2, text: "No double data entry ever again" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#2CA01C]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3 h-3 text-[#2CA01C]" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="bg-[#2CA01C] hover:bg-[#238A17] text-white w-full sm:w-auto">
              <a href="/api/quickbooks/connect">
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect QuickBooks
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Free to connect. Works with QuickBooks Online Simple Start ($19/mo) and above.
              You&apos;ll be redirected to Intuit to authorize access — we only request accounting permissions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Feature preview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: FileText, title: "Invoices", desc: "Pushed to QBO with line items and totals. Status updates sync back." },
          { icon: Users,    title: "Customers", desc: "New customers created in QBO. Name, phone, address kept in sync." },
          { icon: CreditCard, title: "Payments", desc: "QBO payment events auto-mark your CrewBooks invoices as paid." },
        ].map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="border-dashed">
            <CardContent className="pt-5">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connected view
// ─────────────────────────────────────────────────────────────────────────────

function ConnectedView({ status, justConnected }: { status: QBOStatus; justConnected: boolean }) {
  const { toast } = useToast();
  const router    = useRouter();
  const [, startTransition] = useTransition();

  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting,  setDisconnecting]  = useState(false);
  const [syncing,        setSyncing]        = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [resyncing,      setResyncing]      = useState(false);
  const [expandedError,  setExpandedError]  = useState<string | null>(null);
  const [companyName,    setCompanyName]    = useState<string | null>(status.companyName);

  const [syncSettings, setSyncSettings] = useState<QBOSyncSettings>(status.syncSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch company name on mount if not cached
  useEffect(() => {
    if (companyName) return;
    fetch("/api/quickbooks/company-info")
      .then((r) => r.json())
      .then((j: { companyName?: string }) => { if (j.companyName) setCompanyName(j.companyName); })
      .catch(() => {});
  }, [companyName]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/quickbooks/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "QuickBooks disconnected" });
      setDisconnectOpen(false);
      startTransition(() => router.refresh());
    } catch {
      toast({ title: "Disconnect failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const res  = await fetch("/api/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      });
      const json = await res.json() as {
        customers_pushed?: number;
        invoices_pushed?:  number;
        customers_pulled?: number;
        errors?:           string[];
        error?:            string;
      };
      if (json.error) throw new Error(json.error);
      toast({
        title: "Sync complete",
        description: `${json.customers_pushed ?? 0} customers, ${json.invoices_pushed ?? 0} invoices pushed. ${json.customers_pulled ?? 0} customers pulled.`,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast({ title: "Sync failed", description: msg, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleImportCustomers = async () => {
    setImporting(true);
    try {
      const res  = await fetch("/api/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pull_customers" }),
      });
      const json = await res.json() as { customers_pulled?: number; error?: string };
      if (json.error) throw new Error(json.error);
      toast({ title: `Imported ${json.customers_pulled ?? 0} customers from QuickBooks` });
      startTransition(() => router.refresh());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleResyncErrors = async () => {
    setResyncing(true);
    try {
      const res  = await fetch("/api/quickbooks/resync-errors", { method: "POST" });
      const json = await res.json() as { retried?: number; errors?: string[]; error?: string };
      if (json.error) throw new Error(json.error);
      toast({ title: `Re-synced ${json.retried ?? 0} items` });
      startTransition(() => router.refresh());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Re-sync failed";
      toast({ title: "Re-sync failed", description: msg, variant: "destructive" });
    } finally {
      setResyncing(false);
    }
  };

  const handleToggleSetting = async (key: keyof QBOSyncSettings, value: boolean) => {
    const updated = { ...syncSettings, [key]: value };
    setSyncSettings(updated);
    setSavingSettings(true);
    const { error } = await saveQBOSyncSettingsAction(updated);
    setSavingSettings(false);
    if (error) {
      toast({ title: "Failed to save setting", description: error, variant: "destructive" });
      setSyncSettings(syncSettings); // revert
    }
  };

  const errorEntries = status.syncLog.filter((l) => l.status === "error");

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Success banner */}
      {justConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          QuickBooks connected successfully! Your account is now linked.
        </div>
      )}

      {/* Error warning banner */}
      {status.errorCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{status.errorCount} item{status.errorCount !== 1 ? "s" : ""} failed to sync</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
            onClick={handleResyncErrors}
            disabled={resyncing}
          >
            {resyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
            {resyncing ? "Retrying…" : "Re-sync Failed Items"}
          </Button>
        </div>
      )}

      {/* Connection status card */}
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-[#2CA01C]" />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#2CA01C] flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white font-extrabold text-base tracking-tight">QB</span>
              </div>
              <div>
                <CardTitle className="text-base">{companyName ?? "QuickBooks Online"}</CardTitle>
                <CardDescription className="mt-0.5">QuickBooks Online</CardDescription>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 border divide-y text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Connected since</span>
              <span className="font-medium">{fmtDate(status.connectedAt)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Last sync</span>
              <span className="font-medium">{fmtDate(status.lastSyncAt)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Company ID</span>
              <span className="font-mono text-xs text-muted-foreground">{status.realmId}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleFullSync} disabled={syncing} size="sm">
              {syncing
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Syncing…</>
                : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Sync All Now</>}
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportCustomers} disabled={importing}>
              {importing
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Importing…</>
                : <><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Import Customers from QuickBooks</>}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/quickbooks/connect">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reconnect
              </a>
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setDisconnectOpen(true)}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Unplug className="w-3.5 h-3.5 mr-1.5" />Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Sync Settings</CardTitle>
            {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-0 divide-y">
          {[
            {
              key:   "auto_sync_invoices" as const,
              label: "Auto-sync invoices",
              desc:  "When an invoice is created or sent, automatically push to QuickBooks",
              icon:  FileText,
            },
            {
              key:   "auto_sync_customers" as const,
              label: "Auto-sync customers",
              desc:  "When a customer is created or updated, automatically push to QuickBooks",
              icon:  Users,
            },
            {
              key:   "pull_payments" as const,
              label: "Pull payments from QuickBooks",
              desc:  "When a payment is recorded in QuickBooks, mark the CrewBooks invoice as paid",
              icon:  CreditCard,
            },
          ].map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <Label htmlFor={key} className="text-sm font-medium cursor-pointer">{label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <Switch
                id={key}
                checked={syncSettings[key]}
                onCheckedChange={(v) => handleToggleSetting(key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sync history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Sync History</CardTitle>
          <CardDescription className="text-xs">Last 20 sync events</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {status.syncLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Clock className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No sync history yet</p>
              <p className="text-xs mt-1">Events will appear here after your first sync</p>
            </div>
          ) : (
            <div className="divide-y">
              {status.syncLog.map((entry) => {
                const isError    = entry.status === "error";
                const isExpanded = expandedError === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`px-4 py-3 text-sm ${isError ? "cursor-pointer hover:bg-red-50/50" : ""}`}
                    onClick={() => isError && setExpandedError(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isError ? "bg-destructive" : "bg-green-500"}`} />

                      {/* Entity type */}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ${
                        entry.entity_type === "invoice"  ? "bg-blue-100 text-blue-700"  :
                        entry.entity_type === "customer" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {entry.entity_type}
                      </span>

                      {/* Direction */}
                      <span className="text-muted-foreground shrink-0">
                        {entry.direction === "push"
                          ? <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                          : <ArrowLeft  className="w-3.5 h-3.5 text-purple-500" />}
                      </span>

                      {/* Status */}
                      <span className={`text-xs shrink-0 ${isError ? "text-destructive font-medium" : "text-green-700"}`}>
                        {isError ? "Failed" : "Success"}
                      </span>

                      {/* QBO ID */}
                      {entry.qbo_id && (
                        <span className="font-mono text-xs text-muted-foreground hidden sm:inline truncate">
                          ID: {entry.qbo_id}
                        </span>
                      )}

                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{fmtTime(entry.created_at)}</span>
                    </div>

                    {/* Expanded error */}
                    {isError && isExpanded && entry.error_message && (
                      <div className="mt-2 ml-5 p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 font-mono break-all">
                        {entry.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect dialog */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect QuickBooks?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will revoke CrewBooks&apos; access to your QuickBooks account. Synced data will remain in both systems, but no new syncs will occur until you reconnect.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisconnectOpen(false)} disabled={disconnecting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Disconnecting…</> : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function QuickBooksTab({ status, justConnected, errorCode }: QuickBooksTabProps) {
  if (!status.connected) {
    return <NotConnectedView errorCode={errorCode} />;
  }
  return <ConnectedView status={status} justConnected={justConnected} />;
}
