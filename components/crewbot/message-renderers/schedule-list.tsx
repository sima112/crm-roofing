import Link from "next/link";
import { Clock, User } from "lucide-react";

type ScheduledJob = {
  id: string;
  title: string;
  customer_name: string;
  customer_phone?: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  priority: string;
};

type ScheduleOutput = {
  found: boolean;
  count?: number;
  jobs?: ScheduledJob[];
  message?: string;
};

function groupByDate(jobs: ScheduledJob[]): [string, ScheduledJob[]][] {
  const map = new Map<string, ScheduledJob[]>();
  for (const job of jobs) {
    const key = job.scheduled_date;
    const group = map.get(key) ?? [];
    group.push(job);
    map.set(key, group);
  }
  return Array.from(map.entries());
}

function fmtDate(d: string): string {
  const date = new Date(d + "T12:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-600",
  high:   "bg-orange-100 text-orange-600",
};

export function ScheduleList({ output }: { output: unknown }) {
  const data = output as ScheduleOutput;
  if (!data.found || !data.jobs?.length) return null;

  const groups = groupByDate(data.jobs);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-1">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">
          {data.count} job{data.count !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      {groups.map(([date, jobs]) => (
        <div key={date}>
          <div className="px-3 py-1.5 bg-teal-50/40 border-b border-slate-100">
            <p className="text-xs font-semibold text-teal-700">{fmtDate(date)}</p>
          </div>
          {jobs.map((job, i) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-teal-50 transition-colors ${
                i < jobs.length - 1 ? "border-b border-slate-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{job.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <User className="w-3 h-3" />
                    {job.customer_name}
                  </span>
                  {job.scheduled_time && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {job.scheduled_time}
                    </span>
                  )}
                </div>
              </div>
              {PRIORITY_BADGE[job.priority] && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                    PRIORITY_BADGE[job.priority]
                  }`}
                >
                  {job.priority}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
