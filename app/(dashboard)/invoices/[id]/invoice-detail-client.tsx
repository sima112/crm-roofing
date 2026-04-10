"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Download, Pencil, Copy, ExternalLink, Printer,
  MessageSquare, Check, ChevronDown, CheckCircle2, Eye, CircleDashed,
  AlertCircle, AlertTriangle, XCircle, CornerUpLeft, Slash, FileText,
  Clock, DollarSign, RefreshCw, Layers, Mail, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  changeInvoiceStatusAction, sendInvoiceSMSAction,
  waiveLateFeeAction, cancelRecurringAction, sendInvoiceEmailAction,
} from "../invoice-actions";
import { useToast } from "@/components/ui/use-toast";
import { QBOSyncButton } from "@/components/qbo-sync-button";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import {
  STATUS_META, PIPELINE_STEPS, getPipelineIndex, getAvailableTransitions,
  TRANSITION_LABELS, type InvoiceStatus, type StatusHistoryEntry,
} from "@/lib/invoice-status";

// ── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type InvoiceDetailData = {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  notes: string | null;
  stripe_payment_link: string | null;
  qbo_invoice_id:  string | null;
  qbo_sync_status: string | null;
  qbo_synced_at:   string | null;
  qbo_sync_error:  string | null;
  showQBO: boolean;
  line_items: LineItem[];
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  job_title: string | null;
  business: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  status_history:      StatusHistoryEntry[];
  viewed_at:           string | null;
  viewed_count:        number;
  sent_at:             string | null;
  sent_via:            string | null;
  partial_paid_amount: number | null;
  payment_method:      string | null;
  payment_reference:   string | null;
  disputed:            boolean;
  dispute_reason:      string | null;
  // Deposit
  deposit_required:    boolean;
  deposit_amount:      number | null;
  deposit_paid:        boolean;
  deposit_payment_link: string | null;
  // Recurring
  recurring:           boolean;
  recurring_interval:  string | null;
  recurring_next_date: string | null;
  recurring_end_date:  string | null;
  // Late fee
  late_fee_amount:     number;
  late_fee_applied_at: string | null;
};

type DialogType =
  | "paid" | "partial" | "disputed"
  | "confirm_write_off" | "confirm_cancel"
  | "confirm_waive_fee" | "confirm_cancel_recurring"
  | "send_options"
  | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "check",         label: "Check" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card",          label: "Credit / Debit Card" },
  { value: "stripe",        label: "Stripe (Online)" },
  { value: "venmo",         label: "Venmo" },
  { value: "zelle",         label: "Zelle" },
  { value: "other",         label: "Other" },
];

const ACTION_ICONS: Partial<Record<InvoiceStatus, React.ElementType>> = {
  sent: Send, viewed: Eye, partial: CircleDashed, paid: CheckCircle2,
  overdue: AlertCircle, disputed: AlertTriangle, cancelled: XCircle,
  refunded: CornerUpLeft, write_off: Slash, draft: FileText, pending_approval: Clock,
};

const DESTRUCTIVE_ACTIONS: InvoiceStatus[] = ["cancelled", "write_off"];

const INTERVAL_LABELS: Record<string, string> = {
  monthly:     "Monthly",
  quarterly:   "Quarterly",
  semi_annual: "Semi-Annual",
  annual:      "Annual",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvoiceDetailClient({ invoice }: { invoice: InvoiceDetailData }) {
  const router    = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [copied,      setCopied]      = useState(false);
  const [sendingSMS,  setSendingSMS]  = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  const [activeDialog,  setActiveDialog]  = useState<DialogType>(null);
  const [payMethod,     setPayMethod]     = useState("cash");
  const [payRef,        setPayRef]        = useState(invoice.payment_reference ?? "");
  const [payAmount,     setPayAmount]     = useState(
    invoice.partial_paid_amount != null ? String(invoice.partial_paid_amount) : ""
  );
  const [disputeReason, setDisputeReason] = useState(invoice.dispute_reason ?? "");

  const available   = getAvailableTransitions(invoice.status);
  const pipelineIdx = getPipelineIndex(invoice.status as InvoiceStatus);
  const isOnPipeline = PIPELINE_STEPS.includes(invoice.status as InvoiceStatus);
  const isTerminal   = ["cancelled", "write_off", "refunded"].includes(invoice.status);
  const isBranch     = !isOnPipeline && !isTerminal;

  const hasLateFee   = invoice.late_fee_amount > 0;
  const balanceAmount = invoice.deposit_required && invoice.deposit_amount != null
    ? invoice.total - invoice.deposit_amount
    : null;

  // ── Action handlers ───────────────────────────────────────────────────────

  const doTransition = async (
    status: string,
    opts?: { note?: string; paymentMethod?: string; paymentReference?: string; partialAmount?: number; disputeReason?: string }
  ) => {
    setSubmitting(true);
    const { error } = await changeInvoiceStatusAction(invoice.id, status, opts);
    setSubmitting(false);
    setActiveDialog(null);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      startTransition(() => router.refresh());
    }
  };

  const handleActionClick = (status: InvoiceStatus) => {
    if (status === "paid")       { setPayMethod("cash"); setPayRef(""); setActiveDialog("paid");    return; }
    if (status === "partial")    { setPayMethod("cash"); setPayAmount(""); setActiveDialog("partial"); return; }
    if (status === "disputed")   { setDisputeReason(""); setActiveDialog("disputed");               return; }
    if (status === "write_off")  { setActiveDialog("confirm_write_off");                            return; }
    if (status === "cancelled")  { setActiveDialog("confirm_cancel");                               return; }
    doTransition(status);
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Payment link copied!", description: "Send it to your customer via text or email." });
    });
  };

  const handleSendSMS = async () => {
    setSendingSMS(true);
    const { error } = await sendInvoiceSMSAction(invoice.id);
    setSendingSMS(false);
    setActiveDialog(null);
    if (error) toast({ title: "SMS failed", description: error, variant: "destructive" });
    else toast({ title: "SMS sent!", description: "Payment link sent to the customer's phone." });
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    const { error } = await sendInvoiceEmailAction(invoice.id);
    setSendingEmail(false);
    setActiveDialog(null);
    if (error) toast({ title: "Email failed", description: error, variant: "destructive" });
    else {
      toast({ title: "Email sent!", description: `Invoice sent to ${invoice.customer?.email ?? "customer"}.` });
      startTransition(() => router.refresh());
    }
  };

  const handleWaiveFee = async () => {
    setSubmitting(true);
    const { error } = await waiveLateFeeAction(invoice.id);
    setSubmitting(false);
    setActiveDialog(null);
    if (error) toast({ title: "Error", description: error, variant: "destructive" });
    else {
      toast({ title: "Late fee waived" });
      startTransition(() => router.refresh());
    }
  };

  const handleCancelRecurring = async () => {
    setSubmitting(true);
    const { error } = await cancelRecurringAction(invoice.id);
    setSubmitting(false);
    setActiveDialog(null);
    if (error) toast({ title: "Error", description: error, variant: "destructive" });
    else {
      toast({ title: "Recurring cancelled" });
      startTransition(() => router.refresh());
    }
  };

  const customerAddress = [
    invoice.customer?.address,
    [invoice.customer?.city, invoice.customer?.state, invoice.customer?.zip].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-3xl mx-auto">

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Invoices
          </Link>
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <InvoiceStatusBadge
            status={invoice.status}
            partialPaidAmount={invoice.partial_paid_amount ?? undefined}
            total={invoice.total}
            dueDate={invoice.due_date}
          />

          {invoice.recurring && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              <RefreshCw className="w-3 h-3" />
              {INTERVAL_LABELS[invoice.recurring_interval ?? ""] ?? "Recurring"}
            </span>
          )}

          {invoice.showQBO && (
            <QBOSyncButton
              type="invoice"
              id={invoice.id}
              syncStatus={invoice.qbo_sync_status}
              syncedAt={invoice.qbo_synced_at}
              syncError={invoice.qbo_sync_error}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {invoice.status === "draft" && (
                <DropdownMenuItem onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />Edit Invoice
                </DropdownMenuItem>
              )}

              {available.map((transition) => {
                const Icon = ACTION_ICONS[transition] ?? FileText;
                const label = TRANSITION_LABELS[transition] ?? transition;
                const isDestructive = DESTRUCTIVE_ACTIONS.includes(transition);
                return (
                  <DropdownMenuItem
                    key={transition}
                    className={isDestructive ? "text-destructive focus:text-destructive" : ""}
                    onClick={() => handleActionClick(transition)}
                  >
                    <Icon className="mr-2 h-4 w-4" />{label}
                  </DropdownMenuItem>
                );
              })}

              {/* Send options */}
              {(invoice.stripe_payment_link || invoice.customer?.email) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveDialog("send_options")}>
                    <Send className="mr-2 h-4 w-4" />Send Invoice
                  </DropdownMenuItem>
                  {invoice.stripe_payment_link && (
                    <DropdownMenuItem onClick={() => handleCopyLink(invoice.stripe_payment_link!)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {copied ? "Copied!" : "Copy Payment Link"}
                    </DropdownMenuItem>
                  )}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />Print
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/invoices/${invoice.id}/pdf`} download>
                  <Download className="mr-2 h-4 w-4" />Download PDF
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Pipeline progress bar ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-4 print:hidden">
        <div className="flex items-center">
          {PIPELINE_STEPS.map((step, i) => {
            const completed = i < pipelineIdx;
            const current   = i === pipelineIdx && !isTerminal && isOnPipeline;
            const meta      = STATUS_META[step];
            return (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                    completed ? "bg-primary border-primary text-white"
                    : current  ? "border-primary bg-white text-primary"
                    :            "border-slate-200 bg-white text-slate-400"
                  }`}>
                    {completed
                      ? <Check className="w-3.5 h-3.5" />
                      : <span className="text-[10px] font-bold">{i + 1}</span>
                    }
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    current   ? "text-primary font-semibold"
                    : completed ? "text-slate-600"
                    :             "text-slate-400"
                  }`}>
                    {meta.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${completed ? "bg-primary" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {(isBranch || isTerminal) && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Current status:</span>
            <InvoiceStatusBadge
              status={invoice.status}
              partialPaidAmount={invoice.partial_paid_amount ?? undefined}
              total={invoice.total}
              dueDate={invoice.due_date}
            />
            {invoice.dispute_reason && (
              <span className="text-xs text-muted-foreground">— {invoice.dispute_reason}</span>
            )}
          </div>
        )}

        {(invoice.viewed_count > 0 || invoice.sent_at || invoice.partial_paid_amount != null) && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
            {invoice.sent_at && (
              <span>Sent {fmtDateTime(invoice.sent_at)}{invoice.sent_via ? ` via ${invoice.sent_via}` : ""}</span>
            )}
            {invoice.viewed_count > 0 && (
              <span>Viewed {invoice.viewed_count}× {invoice.viewed_at ? `(last: ${fmtDateTime(invoice.viewed_at)})` : ""}</span>
            )}
            {invoice.partial_paid_amount != null && (
              <span className="text-amber-700 font-medium">
                <DollarSign className="inline w-3 h-3 -mt-0.5" />
                {fmt(invoice.partial_paid_amount)} of {fmt(invoice.total)} paid
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Deposit progress ────────────────────────────────────────────── */}
      {invoice.deposit_required && invoice.deposit_amount != null && (
        <div className="bg-white rounded-xl border p-4 print:hidden">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Split Payment</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg border p-3 ${invoice.deposit_paid ? "bg-green-50 border-green-200" : "bg-muted/40"}`}>
              <p className="text-xs text-muted-foreground mb-1">Deposit</p>
              <p className="text-lg font-bold tabular-nums">{fmt(invoice.deposit_amount)}</p>
              {invoice.deposit_paid ? (
                <p className="text-xs text-green-700 font-medium mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />Paid
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">Due before work starts</p>
              )}
              {invoice.deposit_payment_link && !invoice.deposit_paid && (
                <a
                  href={invoice.deposit_payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs text-primary underline flex items-center gap-1"
                >
                  Pay deposit <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className={`rounded-lg border p-3 ${
              invoice.status === "paid" ? "bg-green-50 border-green-200"
              : invoice.deposit_paid ? "bg-muted/40"
              : "bg-muted/20 opacity-60"
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Balance</p>
              <p className="text-lg font-bold tabular-nums">{fmt(balanceAmount ?? 0)}</p>
              {invoice.status === "paid" ? (
                <p className="text-xs text-green-700 font-medium mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />Paid
                </p>
              ) : invoice.deposit_paid ? (
                <p className="text-xs text-amber-600 mt-1">Due on completion</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Due after deposit</p>
              )}
              {invoice.stripe_payment_link && invoice.deposit_paid && invoice.status !== "paid" && (
                <a
                  href={invoice.stripe_payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs text-primary underline flex items-center gap-1"
                >
                  Pay balance <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recurring info ──────────────────────────────────────────────── */}
      {invoice.recurring && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start justify-between gap-4 print:hidden">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-900">Recurring Invoice</p>
              <p className="text-xs text-violet-700 mt-0.5">
                {INTERVAL_LABELS[invoice.recurring_interval ?? ""] ?? "Recurring"}
                {invoice.recurring_next_date && ` · Next: ${fmtDate(invoice.recurring_next_date)}`}
                {invoice.recurring_end_date && ` · Ends: ${fmtDate(invoice.recurring_end_date)}`}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-violet-300 text-violet-700 hover:bg-violet-100 shrink-0"
            onClick={() => setActiveDialog("confirm_cancel_recurring")}
          >
            <X className="w-3 h-3 mr-1" />
            Cancel Recurring
          </Button>
        </div>
      )}

      {/* ── Late fee notice ─────────────────────────────────────────────── */}
      {hasLateFee && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4 print:hidden">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Late Fee Applied</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {fmt(invoice.late_fee_amount)} late fee added on {fmtDate(invoice.late_fee_applied_at)}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
            onClick={() => setActiveDialog("confirm_waive_fee")}
          >
            Waive Fee
          </Button>
        </div>
      )}

      {/* ── Printable invoice card ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm p-8 sm:p-10 print:shadow-none print:border-none print:rounded-none">

        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between mb-8">
          <div>
            <p className="text-xl font-bold text-primary">{invoice.business.name}</p>
            {invoice.business.address && <p className="text-sm text-muted-foreground mt-1">{invoice.business.address}</p>}
            {invoice.business.phone   && <p className="text-sm text-muted-foreground">{invoice.business.phone}</p>}
            {invoice.business.email   && <p className="text-sm text-muted-foreground">{invoice.business.email}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-3xl font-black tracking-tight text-slate-900 uppercase">Invoice</p>
            <div className="mt-2 space-y-0.5 text-sm">
              <p><span className="text-muted-foreground">Invoice # </span><span className="font-mono font-semibold">{invoice.invoice_number}</span></p>
              <p><span className="text-muted-foreground">Date: </span><span>{fmtDate(invoice.created_at)}</span></p>
              <p>
                <span className="text-muted-foreground">Due: </span>
                <span className={invoice.status === "overdue" ? "text-destructive font-semibold" : ""}>{fmtDate(invoice.due_date)}</span>
              </p>
              {invoice.job_title && <p className="text-xs text-muted-foreground mt-1">Re: {invoice.job_title}</p>}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Bill To</p>
          <p className="font-semibold text-lg">{invoice.customer?.name ?? "—"}</p>
          {customerAddress && <p className="text-sm text-muted-foreground mt-0.5">{customerAddress}</p>}
          {invoice.customer?.phone && <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>}
          {invoice.customer?.email && <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>}
        </div>

        <div className="mb-6 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Qty</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Unit Price</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.line_items.map((li, i) => (
                <tr key={i} className={`${i % 2 === 1 ? "bg-slate-50/50" : ""} ${li.description.startsWith("Late fee") ? "bg-amber-50/60" : ""}`}>
                  <td className="px-4 py-3">{li.description}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{li.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(li.unit_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{fmt(invoice.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({(invoice.tax_rate * 100).toFixed(2)}%)</span>
              <span className="tabular-nums">{fmt(invoice.tax_amount)}</span>
            </div>
            {hasLateFee && (
              <div className="flex justify-between text-sm text-amber-700">
                <span>Late Fee</span>
                <span className="tabular-nums">{fmt(invoice.late_fee_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total Due</span>
              <span className="text-primary tabular-nums">{fmt(invoice.total)}</span>
            </div>
            {invoice.partial_paid_amount != null && (
              <div className="flex justify-between text-sm text-amber-700 font-medium">
                <span>Paid</span>
                <span className="tabular-nums">{fmt(invoice.partial_paid_amount)}</span>
              </div>
            )}
            {invoice.status === "paid" && invoice.paid_date && (
              <p className="text-xs text-green-600 text-right pt-1">
                Paid {fmtDate(invoice.paid_date)}
                {invoice.payment_method && ` · ${invoice.payment_method}`}
                {invoice.payment_reference && ` · Ref: ${invoice.payment_reference}`}
              </p>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t pt-6 mt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {invoice.stripe_payment_link && ["sent", "viewed", "overdue", "partial"].includes(invoice.status) && (
          <div className="border-t pt-6 mt-6 flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">Pay securely online with credit or debit card</p>
            <a
              href={invoice.stripe_payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Pay Online — {fmt(invoice.total)}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* ── Status history ──────────────────────────────────────────────── */}
      {invoice.status_history.length > 0 && (
        <div className="bg-white rounded-xl border print:hidden">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 rounded-xl transition-colors"
          >
            <span>Status History <span className="text-muted-foreground font-normal">({invoice.status_history.length} events)</span></span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </button>
          {historyOpen && (
            <div className="border-t px-4 pb-4">
              <div className="space-y-3 mt-4">
                {[...invoice.status_history].reverse().map((entry, i) => {
                  const meta = STATUS_META[entry.status] ?? STATUS_META.draft;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${meta.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{meta.label}</span>
                          {entry.changed_by && <span className="text-xs text-muted-foreground">by {entry.changed_by}</span>}
                        </div>
                        {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(entry.changed_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* Send options */}
      <Dialog open={activeDialog === "send_options"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Send Invoice</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {invoice.customer?.email && (
              <Button
                className="w-full justify-start gap-3"
                variant="outline"
                disabled={sendingEmail}
                onClick={handleSendEmail}
              >
                <Mail className="w-4 h-4" />
                {sendingEmail ? "Sending…" : `Send via Email${invoice.customer.email ? ` — ${invoice.customer.email}` : ""}`}
              </Button>
            )}
            {invoice.stripe_payment_link && (
              <Button
                className="w-full justify-start gap-3"
                variant="outline"
                disabled={sendingSMS}
                onClick={handleSendSMS}
              >
                <MessageSquare className="w-4 h-4" />
                {sendingSMS ? "Sending…" : `Send via SMS${invoice.customer?.phone ? ` — ${invoice.customer.phone}` : ""}`}
              </Button>
            )}
            {invoice.stripe_payment_link && (
              <Button
                className="w-full justify-start gap-3"
                variant="outline"
                onClick={() => { handleCopyLink(invoice.stripe_payment_link!); setActiveDialog(null); }}
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied!" : "Copy Payment Link"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid */}
      <Dialog open={activeDialog === "paid"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Mark as Paid</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference / Check # <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="e.g. Check #1042" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => doTransition("paid", { paymentMethod: payMethod, paymentReference: payRef || undefined })}
            >
              {submitting ? "Saving…" : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Partial Payment */}
      <Dialog open={activeDialog === "partial"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Partial Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount Received</Label>
              <Input
                type="number" min="0" step="0.01"
                placeholder={`of ${fmt(invoice.total)}`}
                value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              size="sm" disabled={submitting || !payAmount}
              onClick={() => doTransition("partial", { partialAmount: parseFloat(payAmount), paymentMethod: payMethod })}
            >
              {submitting ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Disputed */}
      <Dialog open={activeDialog === "disputed"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Mark as Disputed</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              placeholder="Describe the dispute…" rows={3}
              value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              size="sm" variant="destructive" disabled={submitting}
              onClick={() => doTransition("disputed", { disputeReason: disputeReason || undefined })}
            >
              {submitting ? "Saving…" : "Mark as Disputed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Write-Off */}
      <Dialog open={activeDialog === "confirm_write_off"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Write Off Invoice?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This marks the invoice as uncollectable. The customer will not be billed. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={submitting}
              onClick={() => doTransition("write_off", { note: "Written off" })}>
              {submitting ? "Saving…" : "Write Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel Invoice */}
      <Dialog open={activeDialog === "confirm_cancel"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Cancel Invoice?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will cancel the invoice. You can reopen it as a draft later.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Keep</Button>
            <Button size="sm" variant="destructive" disabled={submitting}
              onClick={() => doTransition("cancelled")}>
              {submitting ? "Saving…" : "Cancel Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Waive Late Fee */}
      <Dialog open={activeDialog === "confirm_waive_fee"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Waive Late Fee?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the {fmt(invoice.late_fee_amount)} late fee from this invoice. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Keep Fee</Button>
            <Button size="sm" disabled={submitting} onClick={handleWaiveFee}>
              {submitting ? "Saving…" : "Waive Late Fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel Recurring */}
      <Dialog open={activeDialog === "confirm_cancel_recurring"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Cancel Recurring Schedule?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            No further invoices will be auto-generated. This invoice will remain unchanged.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>Keep Recurring</Button>
            <Button size="sm" variant="destructive" disabled={submitting} onClick={handleCancelRecurring}>
              {submitting ? "Saving…" : "Cancel Recurring"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
