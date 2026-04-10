import Link from "next/link";
import { Phone, Mail, MapPin, Briefcase, DollarSign, ArrowRight } from "lucide-react";

type CustomerResult = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
  job_count: number;
  total_revenue: string;
};

export function CustomerCard({ customer }: { customer: CustomerResult }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-slate-800 text-sm leading-tight">{customer.name}</p>
        <Link
          href={`/customers/${customer.id}`}
          className="shrink-0 p-1 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
          title="View profile"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-0.5 mb-2">
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
          >
            <Phone className="w-3 h-3 shrink-0" />
            {customer.phone}
          </a>
        )}
        {customer.email && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
            <Mail className="w-3 h-3 shrink-0" />
            {customer.email}
          </p>
        )}
        {customer.address && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3 h-3 shrink-0" />
            {customer.address}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Briefcase className="w-3 h-3" />
          {customer.job_count} {customer.job_count === 1 ? "job" : "jobs"}
        </span>
        <span className="flex items-center gap-1 text-xs text-teal-700 font-medium">
          <DollarSign className="w-3 h-3" />
          {customer.total_revenue}
        </span>
        <Link
          href={`/customers/${customer.id}`}
          className="ml-auto text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          View Profile →
        </Link>
      </div>
    </div>
  );
}

export function CustomerCardList({ output }: { output: unknown }) {
  const data = output as {
    found: boolean;
    customers?: CustomerResult[];
    customer?: { id: string; name: string; phone: string | null; email: string | null; address: string; notes: string | null };
    message?: string;
  };

  // getCustomerDetail returns a single customer in a different shape
  if (data.customer) {
    const c = data.customer;
    return (
      <div className="mt-1">
        <CustomerCard
          customer={{
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            job_count: 0,
            total_revenue: "$0.00",
          }}
        />
      </div>
    );
  }

  if (!data.found || !data.customers?.length) return null;

  return (
    <div className="space-y-2 mt-1">
      {data.customers.map((c) => (
        <CustomerCard key={c.id} customer={c} />
      ))}
    </div>
  );
}
