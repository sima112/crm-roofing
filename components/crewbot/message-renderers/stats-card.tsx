type StatsOutput = {
  period: string;
  revenue: string;
  outstanding_balance: string;
  jobs_completed: number;
  jobs_scheduled: number;
  top_customers: string[];
};

const PERIOD_LABELS: Record<string, string> = {
  today:      "Today",
  this_week:  "This Week",
  this_month: "This Month",
  this_year:  "This Year",
};

export function StatsCard({ output }: { output: unknown }) {
  const data = output as StatsOutput;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-1">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {PERIOD_LABELS[data.period] ?? data.period} Overview
        </p>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2">
        <div className="bg-teal-50 rounded-lg p-2.5">
          <p className="text-xs text-teal-600 font-medium">Revenue</p>
          <p className="text-base font-bold text-teal-800 mt-0.5">{data.revenue}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2.5">
          <p className="text-xs text-amber-600 font-medium">Outstanding</p>
          <p className="text-base font-bold text-amber-800 mt-0.5">{data.outstanding_balance}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2.5">
          <p className="text-xs text-blue-600 font-medium">Jobs Done</p>
          <p className="text-base font-bold text-blue-800 mt-0.5">{data.jobs_completed}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Scheduled</p>
          <p className="text-base font-bold text-slate-700 mt-0.5">{data.jobs_scheduled}</p>
        </div>
      </div>

      {data.top_customers?.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Top Customers
          </p>
          <div className="space-y-1">
            {data.top_customers.map((c, i) => (
              <p key={i} className="text-xs text-slate-700">
                <span className="text-slate-400 mr-1.5">{i + 1}.</span>
                {c}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
