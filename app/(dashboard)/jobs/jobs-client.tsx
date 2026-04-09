"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddJobDialog } from "./add-job-dialog";

export type JobSummary = {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  actual_amount: number | null;
  estimated_amount: number | null;
  customer_name: string;
  customer_id: string;
};

type View = "calendar" | "list";
type StatusFilter = "all" | "scheduled" | "in_progress" | "completed" | "cancelled";

const STATUS_PILL: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({
  jobs,
  onAddJob,
}: {
  jobs: JobSummary[];
  onAddJob: (date: string) => void;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = new Date().toISOString().split("T")[0];

  const firstDay = new Date(month.year, month.month, 1);
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  // 0=Sun, we want Mon start
  const startOffset = (firstDay.getDay() + 6) % 7;

  const monthName = firstDay.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Map date string → jobs
  const jobsByDate = useMemo(() => {
    const map: Record<string, JobSummary[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_date) continue;
      if (!map[job.scheduled_date]) map[job.scheduled_date] = [];
      map[job.scheduled_date].push(job);
    }
    return map;
  }, [jobs]);

  const prevMonth = () =>
    setMonth((m) => {
      const d = new Date(m.year, m.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const nextMonth = () =>
    setMonth((m) => {
      const d = new Date(m.year, m.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const goToday = () => {
    const d = new Date();
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Build grid cells: empty + day numbers
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });

  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <button
          className="flex-1 text-center font-semibold text-sm hover:text-primary transition-colors"
          onClick={goToday}
        >
          {monthName}
        </button>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="rounded-xl border overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 bg-muted/40 border-b">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 divide-x divide-y">
          {cells.map((cell, i) => {
            const isToday = cell.dateStr === today;
            const dayJobs = cell.dateStr ? (jobsByDate[cell.dateStr] ?? []) : [];
            return (
              <div
                key={i}
                className={`min-h-[80px] p-1 flex flex-col gap-0.5 ${
                  cell.day ? "cursor-pointer hover:bg-muted/30 transition-colors" : "bg-muted/10"
                }`}
                onClick={() => {
                  if (cell.dateStr) onAddJob(cell.dateStr);
                }}
              >
                {cell.day && (
                  <>
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-start ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {dayJobs.slice(0, 3).map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          className={`text-left text-[10px] font-medium px-1.5 py-0.5 rounded border truncate ${
                            STATUS_PILL[job.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/jobs/${job.id}`);
                          }}
                          title={`${job.customer_name} — ${job.title}`}
                        >
                          {fmtTime(job.scheduled_time)
                            ? `${fmtTime(job.scheduled_time)} `
                            : ""}
                          {job.customer_name}
                        </button>
                      ))}
                      {dayJobs.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{dayJobs.length - 3} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({
  jobs,
  statusFilter,
}: {
  jobs: JobSummary[];
  statusFilter: StatusFilter;
}) {
  const router = useRouter();

  const filtered = useMemo(() => {
    const rows =
      statusFilter === "all"
        ? jobs
        : jobs.filter((j) => j.status === statusFilter);

    return [...rows].sort((a, b) => {
      // Scheduled + in_progress: ascending (upcoming first)
      // Completed + cancelled: descending (recent first)
      const aDate = a.scheduled_date ?? "";
      const bDate = b.scheduled_date ?? "";
      if (
        statusFilter === "completed" ||
        statusFilter === "cancelled"
      ) {
        return bDate.localeCompare(aDate);
      }
      return aDate.localeCompare(bDate);
    });
  }, [jobs, statusFilter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2 rounded-xl border border-dashed">
        <p className="text-sm text-muted-foreground">No jobs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Date</TableHead>
            <TableHead className="hidden sm:table-cell">Time</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((job) => (
            <TableRow
              key={job.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => router.push(`/jobs/${job.id}`)}
            >
              <TableCell className="text-sm whitespace-nowrap">
                {job.scheduled_date
                  ? new Date(job.scheduled_date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )
                  : "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                {fmtTime(job.scheduled_time) || "—"}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {job.customer_name}
                <div className="md:hidden text-xs text-muted-foreground font-normal truncate max-w-[140px]">
                  {job.title}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm max-w-[240px] truncate">
                {job.title}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                    STATUS_PILL[job.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      STATUS_DOT[job.status] ?? "bg-slate-400"
                    }`}
                  />
                  {job.status.replace("_", " ")}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm font-medium hidden sm:table-cell">
                {job.actual_amount != null
                  ? fmt(Number(job.actual_amount))
                  : job.estimated_amount != null
                  ? `~${fmt(Number(job.estimated_amount))}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

interface JobsClientProps {
  jobs: JobSummary[];
}

export function JobsClient({ jobs }: JobsClientProps) {
  const [view, setView] = useState<View>("calendar");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<string | undefined>();

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: jobs.length,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const j of jobs) {
      if (j.status in c) c[j.status]++;
    }
    return c;
  }, [jobs]);

  const handleAddOnDate = (date: string) => {
    setDialogDate(date);
    setDialogOpen(true);
  };

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "scheduled", label: "Scheduled" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View toggle */}
        <div className="flex items-center rounded-lg border p-0.5 w-fit">
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "calendar"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>

        <Button size="sm" onClick={() => { setDialogDate(undefined); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Job
        </Button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input text-muted-foreground hover:border-primary hover:text-foreground"
            }`}
          >
            {value !== "all" && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusFilter === value ? "bg-primary-foreground" : STATUS_DOT[value]
                }`}
              />
            )}
            {label}
            <span
              className={`rounded-full px-1.5 py-0 text-[10px] font-medium ${
                statusFilter === value
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {counts[value]}
            </span>
          </button>
        ))}
      </div>

      {/* View */}
      {view === "calendar" ? (
        <CalendarView
          jobs={
            statusFilter === "all"
              ? jobs
              : jobs.filter((j) => j.status === statusFilter)
          }
          onAddJob={handleAddOnDate}
        />
      ) : (
        <ListView jobs={jobs} statusFilter={statusFilter} />
      )}

      {/* Add Job Dialog */}
      <AddJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={dialogDate}
      />
    </div>
  );
}
