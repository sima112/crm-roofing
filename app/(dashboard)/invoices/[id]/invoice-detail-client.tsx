"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Download,
  Pencil,
  Copy,
  ExternalLink,
  Printer,
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
import { changeInvoiceStatusAction, sendInvoiceSMSAction } from "../invoice-actions";
import { useToast } from "@/components/ui/use-toast";

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
};

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
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

interface InvoiceDetailClientProps {
  invoice: InvoiceDetailData;
}

export function InvoiceDetailClient({ invoice }: InvoiceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);

  const handleStatus = async (status: string) => {
    await changeInvoiceStatusAction(invoice.id, status);
    startTransition(() => router.refresh());
  };

  const handleCopyLink = () => {
    if (!invoice.stripe_payment_link) return;
    navigator.clipboard.writeText(invoice.stripe_payment_link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Payment link copied!",
        description: "Send it to your customer via text or email.",
      });
    });
  };

  const handleSendSMS = async () => {
    setSendingSMS(true);
    const { error } = await sendInvoiceSMSAction(invoice.id);
    setSendingSMS(false);
    if (error) {
      toast({ title: "SMS failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "SMS sent!", description: "Payment link sent to the customer's phone." });
    }
  };

  const customerAddress = [
    invoice.customer?.address,
    [invoice.customer?.city, invoice.customer?.state, invoice.customer?.zip]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Action bar — not printed */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Invoices
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[invoice.status] ?? "bg-slate-100"}`}>
            {invoice.status}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {invoice.status === "draft" && (
                <DropdownMenuItem onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />Edit Invoice
                </DropdownMenuItem>
              )}
              {invoice.status !== "sent" && invoice.status !== "paid" && (
                <DropdownMenuItem onClick={() => handleStatus("sent")}>
                  <Send className="mr-2 h-4 w-4" />Mark as Sent
                </DropdownMenuItem>
              )}
              {invoice.status !== "paid" && (
                <DropdownMenuItem onClick={() => handleStatus("paid")}>
                  <CheckCircle className="mr-2 h-4 w-4" />Mark as Paid
                </DropdownMenuItem>
              )}
              {invoice.stripe_payment_link && (
                <>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? "Copied!" : "Copy Payment Link"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSendSMS} disabled={sendingSMS}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {sendingSMS ? "Sending…" : "Send via SMS"}
                  </DropdownMenuItem>
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

      {/* Printable invoice card */}
      <div className="bg-white rounded-2xl border shadow-sm p-8 sm:p-10 print:shadow-none print:border-none print:rounded-none">
        {/* Invoice header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between mb-8">
          {/* Business info */}
          <div>
            <p className="text-xl font-bold text-primary">{invoice.business.name}</p>
            {invoice.business.address && (
              <p className="text-sm text-muted-foreground mt-1">{invoice.business.address}</p>
            )}
            {invoice.business.phone && (
              <p className="text-sm text-muted-foreground">{invoice.business.phone}</p>
            )}
            {invoice.business.email && (
              <p className="text-sm text-muted-foreground">{invoice.business.email}</p>
            )}
          </div>

          {/* Invoice meta */}
          <div className="sm:text-right">
            <p className="text-3xl font-black tracking-tight text-slate-900 uppercase">
              Invoice
            </p>
            <div className="mt-2 space-y-0.5 text-sm">
              <p>
                <span className="text-muted-foreground">Invoice # </span>
                <span className="font-mono font-semibold">{invoice.invoice_number}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Date: </span>
                <span>{fmtDate(invoice.created_at)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Due: </span>
                <span className={invoice.status === "overdue" ? "text-destructive font-semibold" : ""}>
                  {fmtDate(invoice.due_date)}
                </span>
              </p>
              {invoice.job_title && (
                <p className="text-xs text-muted-foreground mt-1">Re: {invoice.job_title}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Bill To
          </p>
          <p className="font-semibold text-lg">{invoice.customer?.name ?? "—"}</p>
          {customerAddress && <p className="text-sm text-muted-foreground mt-0.5">{customerAddress}</p>}
          {invoice.customer?.phone && (
            <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>
          )}
          {invoice.customer?.email && (
            <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
          )}
        </div>

        {/* Line items table */}
        <div className="mb-6 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Description
                </th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">
                  Qty
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
                  Unit Price
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.line_items.map((li, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                  <td className="px-4 py-3">{li.description}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{li.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(li.unit_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{fmt(Number(invoice.amount))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({(Number(invoice.tax_rate) * 100).toFixed(2)}%)
              </span>
              <span className="tabular-nums">{fmt(Number(invoice.tax_amount))}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total Due</span>
              <span className="text-primary tabular-nums">{fmt(Number(invoice.total))}</span>
            </div>
            {invoice.status === "paid" && invoice.paid_date && (
              <p className="text-xs text-green-600 text-right pt-1">
                Paid {fmtDate(invoice.paid_date)}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t pt-6 mt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Notes
            </p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Pay Online CTA */}
        {invoice.stripe_payment_link && invoice.status === "sent" && (
          <div className="border-t pt-6 mt-6 flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Pay securely online with credit or debit card
            </p>
            <a
              href={invoice.stripe_payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Pay Online — {fmt(Number(invoice.total))}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
