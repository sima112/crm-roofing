"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, Clock, Minus } from "lucide-react";

interface QBOStatusBadgeProps {
  status:    string | null | undefined;
  error?:    string | null;
  syncedAt?: string | null;
  qboId?:    string | null;
}

export function QBOStatusBadge({ status, error, syncedAt, qboId }: QBOStatusBadgeProps) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

  let icon: React.ReactNode;
  let tooltip: string;

  if (status === "synced") {
    icon    = <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    tooltip = syncedAt ? `Synced to QBO ${fmtDate(syncedAt)}${qboId ? ` · ID ${qboId}` : ""}` : "Synced to QuickBooks";
  } else if (status === "error") {
    icon    = <XCircle className="w-3.5 h-3.5 text-destructive" />;
    tooltip = error ? `Sync error: ${error}` : "Sync failed";
  } else if (status === "pending") {
    icon    = <Clock className="w-3.5 h-3.5 text-amber-500" />;
    tooltip = "Sync pending";
  } else {
    icon    = <Minus className="w-3.5 h-3.5 text-muted-foreground/40" />;
    tooltip = "Not synced to QuickBooks";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
