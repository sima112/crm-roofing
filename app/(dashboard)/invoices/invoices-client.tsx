"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Send,
  CheckCircle,
  Download,
  Trash2,
  Link as LinkIcon,
  Plus,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { changeInvoiceStatusAction, deleteInvoiceAction, sendInvoiceSMSAction } from "./invoice-actions";
import { useToast } from "@/components/ui/use-toast";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  tax_amount: number;
  total: number;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  customer_name: string;
  job_title: string | null;
  stripe_payment_link: string | null;
};

type Tab = "all" | "draft" | "sent" | "paid" | "overdue";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-400",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

interface InvoicesClientProps {
  invoices: InvoiceRow[];
  summaryCards: {
    outstanding: number;
    paidThisMonth: number;
    overdueCount: number;
  };
}

export function InvoicesClient({ invoices, summaryCards }: InvoicesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const rows = tab === "all" ? invoices : invoices.filter((inv) => inv.status === tab);
    return [...rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [invoices, tab]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: invoices.length, draft: 0, sent: 0, paid: 0, overdue: 0 };
    for (const inv of invoices) {
      if (inv.status in c) (c as Record<string, number>)[inv.status]++;
    }
    return c;
  }, [invoices]);

  const handleStatus = async (id: string, status: string) => {
    await changeInvoiceStatusAction(id, status);
    startTransition(() => router.refresh());
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await deleteInvoiceAction(deleteId);
    setDeleteId(null);
    setDeleting(false);
    startTransition(() => router.refresh());
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      toast({
        title: "Payment link copied!",
        description: "Send it to your customer via text or email.",
      });
    }).catch(() => {});
  };

  const handleSendSMS = async (id: string) => {
    const { error } = await sendInvoiceSMSAction(id);
    if (error) {
      toast({ title: "SMS failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "SMS sent!", description: "Payment link sent to the customer's phone." });
    }
  };

  const TABS: { value: Tab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="shrink-0 rounded-xl border bg-card p-4 min-w-[160px]">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold mt-1">{fmt(summaryCards.outstanding)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sent + overdue</p>
        </div>
        <div className="shrink-0 rounded-xl border bg-card p-4 min-w-[160px]">
          <p className="text-xs text-muted-foreground">Paid This Month</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{fmt(summaryCards.paidThisMonth)}</p>
        </div>
        <div className="shrink-0 rounded-xl border bg-card p-4 min-w-[160px]">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-destructive">{summaryCards.overdueCount}</p>
            {summaryCards.overdueCount > 0 && (
              <span className="text-xs bg-destructive text-destructive-foreground font-semibold px-1.5 py-0.5 rounded-full">
                Action needed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
                tab === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0 text-[10px] font-medium ${
                tab === value ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        <Button size="sm" asChild>
          <Link href="/invoices/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Invoice
          </Link>
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed gap-2">
          <p className="text-sm text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden lg:table-cell">Job</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Amount</TableHead>
                <TableHead className="text-right hidden md:table-cell">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TableCell className="font-mono text-sm font-semibold">
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {inv.customer_name}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[180px] truncate">
                    {inv.job_title ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm hidden sm:table-cell tabular-nums">
                    {fmt(Number(inv.amount))}
                  </TableCell>
                  <TableCell className="text-right text-sm hidden md:table-cell text-muted-foreground tabular-nums">
                    {fmt(Number(inv.tax_amount))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {fmt(Number(inv.total))}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      inv.status === "cancelled"
                        ? "line-through text-slate-400 bg-slate-100"
                        : STATUS_STYLES[inv.status] ?? "bg-slate-100 text-slate-600"
                    }`}>
                      {inv.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {fmtDate(inv.due_date)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />View
                        </DropdownMenuItem>
                        {inv.status === "draft" && (
                          <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {inv.status !== "sent" && inv.status !== "paid" && inv.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => handleStatus(inv.id, "sent")}>
                            <Send className="mr-2 h-4 w-4" />Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => handleStatus(inv.id, "paid")}>
                            <CheckCircle className="mr-2 h-4 w-4" />Mark as Paid
                          </DropdownMenuItem>
                        )}
                        {inv.stripe_payment_link && (
                          <>
                            <DropdownMenuItem onClick={() => handleCopyLink(inv.stripe_payment_link!)}>
                              <LinkIcon className="mr-2 h-4 w-4" />Copy Payment Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendSMS(inv.id)}>
                              <MessageSquare className="mr-2 h-4 w-4" />Send via SMS
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem asChild>
                          <a href={`/api/invoices/${inv.id}/pdf`} download>
                            <Download className="mr-2 h-4 w-4" />Download PDF
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(inv.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Invoice?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the invoice. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
