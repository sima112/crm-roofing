"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { QBOSyncButton } from "@/components/qbo-sync-button";

interface QBOStatus {
  connected: boolean;
  syncEnabled: boolean;
  connectedAt: string | null;
  lastSyncAt:  string | null;
  realmId:     string | null;
}

interface QuickBooksTabProps {
  status:         QBOStatus;
  justConnected:  boolean;
  errorCode:      string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied:           "You cancelled the QuickBooks authorization.",
  invalid_callback:        "Invalid callback from QuickBooks. Please try again.",
  state_mismatch:          "Security check failed. Please try again.",
  token_exchange_failed:   "Failed to exchange authorization code. Please try again.",
  not_configured:          "QuickBooks credentials are not configured on this server.",
  invalid_state:           "Invalid authorization state. Please try again.",
};

export function QuickBooksTab({ status, justConnected, errorCode }: QuickBooksTabProps) {
  const { toast }          = useToast();
  const router             = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect QuickBooks? Synced data will remain but no new syncs will occur.")) return;

    setDisconnecting(true);
    try {
      const res = await fetch("/api/quickbooks/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      toast({ title: "QuickBooks disconnected" });
      router.refresh();
    } catch {
      toast({ title: "Disconnect failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Success banner */}
      {justConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          QuickBooks connected successfully! Your account is now linked.
        </div>
      )}

      {/* Error banner */}
      {errorCode && !justConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <XCircle className="w-4 h-4 shrink-0" />
          {ERROR_MESSAGES[errorCode] ?? "An error occurred. Please try again."}
        </div>
      )}

      {/* Connection card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* QBO logo placeholder */}
              <div className="w-10 h-10 rounded-lg bg-[#2CA01C] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">QB</span>
              </div>
              <div>
                <CardTitle className="text-base">QuickBooks Online</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Sync customers and invoices with your QuickBooks account
                </CardDescription>
              </div>
            </div>
            <Badge variant={status.connected ? "default" : "secondary"} className="shrink-0">
              {status.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {status.connected ? (
            <>
              <div className="rounded-lg bg-muted/50 border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company ID</span>
                  <span className="font-mono text-xs">{status.realmId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected</span>
                  <span>{status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last sync</span>
                  <span>
                    {status.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleString()
                      : "Never synced"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <QBOSyncButton
                  type="full"
                  syncedAt={status.lastSyncAt}
                />
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/quickbooks/connect">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Reconnect
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  {disconnecting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Disconnecting…</>
                  ) : (
                    <><Unplug className="w-3.5 h-3.5 mr-1.5" />Disconnect</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your QuickBooks Online account to automatically sync customers and invoices.
                No double-entry — changes flow in both directions.
              </p>

              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Push new customers and invoices to QuickBooks</li>
                <li>Mark invoices as paid when payment is recorded</li>
                <li>Keep customer contact info in sync</li>
              </ul>

              <Button asChild className="mt-2">
                <a href="/api/quickbooks/connect">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Connect QuickBooks
                </a>
              </Button>

              <p className="text-xs text-muted-foreground">
                You&apos;ll be redirected to Intuit to authorize access. We only request accounting permissions.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* What gets synced */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">What gets synced</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Customers</p>
              <p className="text-muted-foreground text-xs">
                New customers are created in QBO. Name and contact info kept in sync.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Invoices</p>
              <p className="text-muted-foreground text-xs">
                Invoices pushed to QBO with line items and totals. Status updates sync back.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Payments</p>
              <p className="text-muted-foreground text-xs">
                When a Stripe payment is confirmed, QBO invoice is marked paid automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
