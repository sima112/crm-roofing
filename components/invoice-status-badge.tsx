"use client";

import {
  FileText, Clock, Send, Eye, CircleDashed, CheckCircle2,
  AlertCircle, AlertTriangle, XCircle, CornerUpLeft, Slash,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META, type InvoiceStatus } from "@/lib/invoice-status";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Clock, Send, Eye, CircleDashed, CheckCircle2,
  AlertCircle, AlertTriangle, XCircle, CornerUpLeft, Slash,
};

interface InvoiceStatusBadgeProps {
  status:              string;
  partialPaidAmount?:  number;
  total?:              number;
  dueDate?:            string | null;
  className?:          string;
  showIcon?:           boolean;
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const diff = Date.now() - new Date(dueDate + "T00:00:00").getTime();
  return Math.floor(diff / 86_400_000);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function InvoiceStatusBadge({
  status, partialPaidAmount, total, dueDate, className = "", showIcon = true,
}: InvoiceStatusBadgeProps) {
  const meta   = STATUS_META[status as InvoiceStatus] ?? STATUS_META.draft;
  const Icon   = showIcon ? (ICON_MAP[meta.icon] ?? FileText) : null;

  let tooltip = meta.label;
  let label   = meta.label;

  if (status === "overdue" && dueDate) {
    const days = daysOverdue(dueDate);
    if (days > 0) {
      label   = `Overdue`;
      tooltip = `${days} day${days !== 1 ? "s" : ""} overdue`;
    }
  }
  if (status === "partial" && partialPaidAmount != null && total != null) {
    tooltip = `${fmt(partialPaidAmount)} of ${fmt(total)} paid`;
  }

  const badge = (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color} ${
        status === "cancelled" ? "line-through" : ""
      } ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {label}
    </span>
  );

  if (tooltip !== label) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
