import Link from "next/link";
import { Calendar, Clock, User, ArrowRight } from "lucide-react";

type JobResult = {
  id: string;
  title: string;
  customer_name: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_amount: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  scheduled:   "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed:   "bg-green-100 text-green-700",
  cancelled:   "bg-slate-100 text-slate-500",
};

function fmtDate(d: string) {
  const date = new Date(d + "T12:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function JobCard({ job }: { job: JobResult }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-teal-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-slate-800 text-sm leading-tight">{job.title}</p>
        <Link
          href={`/jobs/${job.id}`}
          className="shrink-0 p-1 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <p className="flex items-center gap-1 text-xs text-slate-500 mb-2">
        <User className="w-3 h-3" />
        {job.customer_name}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            STATUS_STYLES[job.status] ?? STATUS_STYLES.scheduled
          }`}
        >
          {job.status.replace(/_/g, " ")}
        </span>

        {job.scheduled_date && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            {fmtDate(job.scheduled_date)}
          </span>
        )}

        {job.scheduled_time && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {job.scheduled_time}
          </span>
        )}

        {job.estimated_amount && (
          <span className="ml-auto text-xs font-semibold text-slate-700">
            {job.estimated_amount}
          </span>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100">
        <Link
          href={`/jobs/${job.id}`}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          View Job →
        </Link>
      </div>
    </div>
  );
}

export function JobCardList({ output }: { output: unknown }) {
  const data = output as {
    found?: boolean;
    jobs?: JobResult[];
    job?: JobResult;
    success?: boolean;
    message?: string;
    old_date?: string;
    new_date?: string;
  };

  const jobs = data.jobs ?? (data.job ? [data.job] : []);
  if (!jobs.length) return null;

  return (
    <div className="space-y-2 mt-1">
      {jobs.map((j) => (
        <JobCard key={j.id} job={j} />
      ))}
    </div>
  );
}
