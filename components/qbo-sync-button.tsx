"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type SyncType = "customer" | "invoice" | "full";

interface QBOSyncButtonProps {
  type:         SyncType;
  id?:          string;          // required for customer/invoice
  syncStatus?:  string | null;   // current qbo_sync_status
  syncedAt?:    string | null;   // last qbo_synced_at
  syncError?:   string | null;   // qbo_sync_error
  variant?:     "button" | "icon";
  className?:   string;
}

export function QBOSyncButton({
  type, id, syncStatus, syncedAt, syncError, variant = "button", className,
}: QBOSyncButtonProps) {
  const { toast }  = useToast();
  const router     = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(syncStatus ?? null);
  const [localError,  setLocalError]  = useState<string | null>(syncError  ?? null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/quickbooks/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, id }),
      });
      const json = await res.json() as { error?: string; errors?: string[] };

      if (!res.ok || json.error) {
        const msg = json.error ?? "Sync failed";
        setLocalStatus("error");
        setLocalError(msg);
        toast({ title: "QuickBooks sync failed", description: msg, variant: "destructive" });
      } else {
        setLocalStatus("synced");
        setLocalError(null);
        const label = type === "full"
          ? `Full sync complete`
          : `${type === "customer" ? "Customer" : "Invoice"} synced to QuickBooks`;
        toast({ title: label });
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setLocalStatus("error");
      setLocalError(msg);
      toast({ title: "Sync failed", description: msg, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // Status icon
  const StatusIcon = () => {
    if (syncing) return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    if (localStatus === "synced")  return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    if (localStatus === "error")   return <XCircle       className="w-3.5 h-3.5 text-destructive" />;
    return <RefreshCw className="w-3.5 h-3.5" />;
  };

  const label = type === "full"
    ? (syncing ? "Syncing…" : "Full Sync")
    : (syncing ? "Syncing…" : "Sync to QuickBooks");

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`inline-flex items-center justify-center rounded-full w-5 h-5 hover:opacity-70 transition-opacity disabled:opacity-40 ${className ?? ""}`}
            >
              <StatusIcon />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {localStatus === "error" && localError
              ? `Error: ${localError}`
              : localStatus === "synced" && syncedAt
              ? `Synced ${fmtDate(syncedAt)}`
              : "Click to sync to QuickBooks"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="gap-1.5"
      >
        <StatusIcon />
        {label}
      </Button>
      {syncedAt && localStatus === "synced" && (
        <p className="text-[11px] text-muted-foreground pl-0.5">
          Last synced {fmtDate(syncedAt)}
        </p>
      )}
      {localStatus === "error" && localError && (
        <p className="text-[11px] text-destructive pl-0.5 max-w-xs truncate" title={localError}>
          {localError}
        </p>
      )}
    </div>
  );
}
