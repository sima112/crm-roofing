/**
 * lib/invoice-status.ts
 * State machine for invoice status transitions.
 * Server-safe — no Next.js or Supabase imports at module level.
 */

export type InvoiceStatus =
  | "draft" | "pending_approval" | "sent" | "viewed" | "partial"
  | "paid" | "overdue" | "disputed" | "cancelled" | "refunded" | "write_off";

export type StatusHistoryEntry = {
  status:     InvoiceStatus;
  changed_at: string;
  changed_by: string | null;
  note:       string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:            ["sent", "cancelled", "pending_approval"],
  pending_approval: ["sent", "cancelled"],
  sent:             ["viewed", "partial", "paid", "overdue", "disputed", "cancelled"],
  viewed:           ["partial", "paid", "overdue", "disputed", "cancelled"],
  partial:          ["paid", "overdue", "disputed", "cancelled", "refunded"],
  paid:             ["refunded", "disputed"],
  overdue:          ["partial", "paid", "disputed", "cancelled", "write_off"],
  disputed:         ["sent", "cancelled", "refunded", "write_off"],
  cancelled:        ["draft"],
  refunded:         [],  // terminal
  write_off:        [],  // terminal
};

export function canTransition(current: string, next: string): boolean {
  const allowed = TRANSITIONS[current as InvoiceStatus];
  return !!allowed?.includes(next as InvoiceStatus);
}

export function getAvailableTransitions(current: string): InvoiceStatus[] {
  return TRANSITIONS[current as InvoiceStatus] ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Status metadata (labels, colors, icons)
// ─────────────────────────────────────────────────────────────────────────────

export type StatusMeta = {
  label:   string;
  color:   string;       // Tailwind bg+text classes
  dot:     string;       // dot color
  icon:    string;       // lucide icon name
};

export const STATUS_META: Record<InvoiceStatus, StatusMeta> = {
  draft:            { label: "Draft",            color: "bg-slate-100 text-slate-600",    dot: "bg-slate-400",   icon: "FileText"   },
  pending_approval: { label: "Pending Approval", color: "bg-violet-100 text-violet-700",  dot: "bg-violet-500",  icon: "Clock"      },
  sent:             { label: "Sent",             color: "bg-blue-100 text-blue-700",      dot: "bg-blue-500",    icon: "Send"       },
  viewed:           { label: "Viewed",           color: "bg-teal-100 text-teal-700",      dot: "bg-teal-500",    icon: "Eye"        },
  partial:          { label: "Partial",          color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500",   icon: "CircleDashed" },
  paid:             { label: "Paid",             color: "bg-green-100 text-green-700",    dot: "bg-green-500",   icon: "CheckCircle2" },
  overdue:          { label: "Overdue",          color: "bg-red-100 text-red-700",        dot: "bg-red-500",     icon: "AlertCircle" },
  disputed:         { label: "Disputed",         color: "bg-orange-100 text-orange-700",  dot: "bg-orange-500",  icon: "AlertTriangle" },
  cancelled:        { label: "Cancelled",        color: "bg-slate-100 text-slate-400",    dot: "bg-slate-300",   icon: "XCircle"    },
  refunded:         { label: "Refunded",         color: "bg-purple-100 text-purple-700",  dot: "bg-purple-500",  icon: "CornerUpLeft" },
  write_off:        { label: "Write-Off",        color: "bg-zinc-200 text-zinc-600",      dot: "bg-zinc-500",    icon: "Slash"      },
};

// ─────────────────────────────────────────────────────────────────────────────
// Action labels for dropdowns
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITION_LABELS: Partial<Record<InvoiceStatus, string>> = {
  sent:             "Mark as Sent",
  viewed:           "Mark as Viewed",
  partial:          "Record Partial Payment",
  paid:             "Mark as Paid",
  overdue:          "Mark as Overdue",
  disputed:         "Mark as Disputed",
  cancelled:        "Cancel Invoice",
  refunded:         "Issue Refund",
  write_off:        "Write Off",
  draft:            "Reopen as Draft",
  pending_approval: "Send for Approval",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline steps (for the visual progress bar)
// ─────────────────────────────────────────────────────────────────────────────

export const PIPELINE_STEPS: InvoiceStatus[] = ["draft", "sent", "viewed", "paid"];

export function getPipelineIndex(status: InvoiceStatus): number {
  // Terminal/branch statuses: map to closest pipeline step
  const map: Partial<Record<InvoiceStatus, number>> = {
    pending_approval: 0,
    partial: 2,
    overdue: 2,
    disputed: 2,
    cancelled: -1,
    refunded: 3,
    write_off: -1,
  };
  const override = map[status];
  if (override !== undefined) return override;
  return PIPELINE_STEPS.indexOf(status);
}

