import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

type InvoiceResult = {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: string;
  due_date: string | null;
  status: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft:            "bg-slate-100 text-slate-600",
  pending_approval: "bg-yellow-100 text-yellow-700",
  sent:             "bg-blue-100 text-blue-700",
  viewed:           "bg-indigo-100 text-indigo-700",
  paid:             "bg-green-100 text-green-700",
  overdue:          "bg-red-100 text-red-700",
  partial:          "bg-amber-100 text-amber-700",
  disputed:         "bg-orange-100 text-orange-700",
  cancelled:        "bg-slate-100 text-slate-500",
  refunded:         "bg-purple-100 text-purple-700",
  write_off:        "bg-slate-100 text-slate-400",
};

export function InvoiceCard({ invoice }: { invoice: InvoiceResult }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="font-semibold text-slate-800 text-sm font-mono">
            {invoice.invoice_number}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{invoice.customer_name}</p>
        </div>
        <Link
          href={`/invoices/${invoice.id}`}
          className="shrink-0 p-1 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft
          }`}
        >
          {invoice.status.replace(/_/g, " ")}
        </span>

        <span className="text-sm font-bold text-slate-800">{invoice.total}</span>

        {invoice.due_date && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            Due{" "}
            {new Date(invoice.due_date + "T12:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}

        <Link
          href={`/invoices/${invoice.id}`}
          className="ml-auto text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

export function InvoiceCardDisplay({ output }: { output: unknown }) {
  const data = output as {
    success?: boolean;
    invoice?: InvoiceResult;
    found?: boolean;
    invoices?: InvoiceResult[];
    sent_via?: string[];
    message?: string;
  };

  const invoices = data.invoices ?? (data.invoice ? [data.invoice] : []);
  if (!invoices.length) return null;

  return (
    <div className="space-y-2 mt-1">
      {invoices.map((inv) => (
        <InvoiceCard key={inv.id} invoice={inv} />
      ))}
    </div>
  );
}
