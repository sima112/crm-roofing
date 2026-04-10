import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  DollarSign,
  Wrench,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Minus,
  UserPlus,
  CheckCircle2,
  FileText,
  AlertCircle,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Greeting } from "./greeting";
import { RealtimeRefresh } from "./realtime-refresh";

export const metadata: Metadata = { title: "Dashboard" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function fmtTime(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function pct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const JOB_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) redirect("/login");

  // ── Date helpers ──────────────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = monthStart;

  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // ── Parallel data fetches ─────────────────────────────────────────────────
  const [
    { data: paidThisMonth },
    { data: paidLastMonth },
    { data: completedThisMonth },
    { data: completedLastMonth },
    { data: outstandingInvoices },
    { data: upcomingJobs },
    { data: todaysJobs },
    { data: overdueInvoices },
    { data: recentCustomers },
    { data: recentJobs },
    { data: recentInvoices },
    { data: agingData },
  ] = await Promise.all([
    // Revenue: paid invoices this month
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_date", monthStart),

    // Revenue: paid invoices last month
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_date", lastMonthStart)
      .lt("paid_date", lastMonthEnd),

    // Jobs completed this month
    supabase
      .from("jobs")
      .select("id")
      .eq("status", "completed")
      .gte("completed_date", monthStart),

    // Jobs completed last month
    supabase
      .from("jobs")
      .select("id")
      .eq("status", "completed")
      .gte("completed_date", lastMonthStart)
      .lt("completed_date", lastMonthEnd),

    // Outstanding: unpaid invoices
    supabase
      .from("invoices")
      .select("total")
      .in("status", ["sent", "viewed", "partial", "overdue"]),

    // Upcoming scheduled jobs (next 7 days)
    supabase
      .from("jobs")
      .select("id")
      .eq("status", "scheduled")
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", in7Days),

    // Today's schedule
    supabase
      .from("jobs")
      .select("id, title, status, scheduled_time, customers(name)")
      .eq("scheduled_date", todayStr)
      .order("scheduled_time", { ascending: true, nullsFirst: false }),

    // Overdue invoices with customer info
    supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, customers(name)")
      .eq("status", "overdue")
      .order("due_date", { ascending: true }),

    // Recent customers (for activity feed)
    supabase
      .from("customers")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),

    // Recent jobs (for activity feed)
    supabase
      .from("jobs")
      .select("id, title, status, completed_date, created_at, customers(name)")
      .order("created_at", { ascending: false })
      .limit(5),

    // Recent invoices (for activity feed)
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, paid_date, created_at, customers(name)")
      .order("created_at", { ascending: false })
      .limit(5),

    // Aging: all unpaid invoices with due_date
    supabase
      .from("invoices")
      .select("total, due_date, status")
      .in("status", ["sent", "viewed", "partial", "overdue"])
      .not("due_date", "is", null),
  ]);

  // ── Compute KPIs ──────────────────────────────────────────────────────────
  const revenueThisMonth = (paidThisMonth ?? []).reduce(
    (s, r) => s + Number(r.total ?? 0),
    0
  );
  const revenueLastMonth = (paidLastMonth ?? []).reduce(
    (s, r) => s + Number(r.total ?? 0),
    0
  );
  const jobsThisMonth = completedThisMonth?.length ?? 0;
  const jobsLastMonth = completedLastMonth?.length ?? 0;
  const outstanding = (outstandingInvoices ?? []).reduce(
    (s, r) => s + Number(r.total ?? 0),
    0
  );
  const upcomingCount = upcomingJobs?.length ?? 0;

  // ── Build activity feed ───────────────────────────────────────────────────
  type ActivityItem = {
    id: string;
    type: "customer" | "job_created" | "job_completed" | "invoice_paid" | "invoice_created";
    label: string;
    time: string;
  };

  const activity: ActivityItem[] = [
    ...(recentCustomers ?? []).map((c) => ({
      id: `c-${c.id}`,
      type: "customer" as const,
      label: `New customer: ${c.name}`,
      time: c.created_at,
    })),
    ...(recentJobs ?? []).flatMap((j) => {
      const customerName =
        (j.customers as unknown as { name: string } | null)?.name ?? "Unknown";
      const items: ActivityItem[] = [
        {
          id: `j-${j.id}`,
          type: "job_created" as const,
          label: `Job added: ${j.title} (${customerName})`,
          time: j.created_at,
        },
      ];
      if (j.status === "completed" && j.completed_date) {
        items.push({
          id: `jc-${j.id}`,
          type: "job_completed" as const,
          label: `Job completed: ${j.title} (${customerName})`,
          time: j.completed_date,
        });
      }
      return items;
    }),
    ...(recentInvoices ?? []).flatMap((inv) => {
      const customerName =
        (inv.customers as unknown as { name: string } | null)?.name ?? "Unknown";
      const items: ActivityItem[] = [
        {
          id: `inv-${inv.id}`,
          type: "invoice_created" as const,
          label: `Invoice ${inv.invoice_number} created — ${customerName}`,
          time: inv.created_at,
        },
      ];
      if (inv.status === "paid" && inv.paid_date) {
        items.push({
          id: `invp-${inv.id}`,
          type: "invoice_paid" as const,
          label: `${inv.invoice_number} paid — ${fmt(Number(inv.total ?? 0))} from ${customerName}`,
          time: inv.paid_date,
        });
      }
      return items;
    }),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 10);

  const activityIcon: Record<ActivityItem["type"], React.ReactNode> = {
    customer: <UserPlus className="w-3.5 h-3.5" />,
    job_created: <Wrench className="w-3.5 h-3.5" />,
    job_completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
    invoice_paid: <DollarSign className="w-3.5 h-3.5 text-green-600" />,
    invoice_created: <FileText className="w-3.5 h-3.5" />,
  };

  // ── Days overdue helper ───────────────────────────────────────────────────
  function daysOverdue(dueDateStr: string | null) {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
  }

  const revPct = pct(revenueThisMonth, revenueLastMonth);
  const jobPct = pct(jobsThisMonth, jobsLastMonth);

  // ── Aging buckets ─────────────────────────────────────────────────────────
  const aging = {
    current:  0,  // due_date >= today (not yet due)
    d1_30:    0,  // 1-30 days overdue
    d31_60:   0,  // 31-60 days
    d61_90:   0,  // 61-90 days
    d90plus:  0,  // 90+ days
  };
  for (const inv of agingData ?? []) {
    const due = new Date((inv.due_date as string) + "T00:00:00");
    const daysLate = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
    const amt = Number(inv.total ?? 0);
    if (daysLate <= 0)      aging.current += amt;
    else if (daysLate <= 30) aging.d1_30   += amt;
    else if (daysLate <= 60) aging.d31_60  += amt;
    else if (daysLate <= 90) aging.d61_90  += amt;
    else                     aging.d90plus += amt;
  }
  const agingTotal = Object.values(aging).reduce((s, v) => s + v, 0);

  function TrendIcon({ value }: { value: number }) {
    if (value > 0)
      return <TrendingUp className="w-3.5 h-3.5 text-green-600" />;
    if (value < 0)
      return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  }

  function TrendLabel({ value }: { value: number }) {
    const color =
      value > 0
        ? "text-green-600"
        : value < 0
        ? "text-red-500"
        : "text-muted-foreground";
    const sign = value > 0 ? "+" : "";
    return (
      <span className={`text-xs font-medium ${color}`}>
        {sign}{value}% vs last month
      </span>
    );
  }

  return (
    <>
      <RealtimeRefresh businessId={business.id} />

      <div className="space-y-6">
        {/* ROW 1 — Greeting */}
        <Greeting businessName={business.name} />

        {/* ROW 2 — KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Revenue this month */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenue This Month
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(revenueThisMonth)}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon value={revPct} />
                <TrendLabel value={revPct} />
              </div>
            </CardContent>
          </Card>

          {/* Jobs this month */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Jobs This Month
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{jobsThisMonth}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon value={jobPct} />
                <TrendLabel value={jobPct} />
              </div>
            </CardContent>
          </Card>

          {/* Outstanding balance */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Outstanding Balance
                </CardTitle>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    outstanding > 0 ? "bg-amber-100" : "bg-primary/10"
                  }`}
                >
                  <Clock
                    className={`w-4 h-4 ${
                      outstanding > 0 ? "text-amber-600" : "text-primary"
                    }`}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  outstanding > 0 ? "text-amber-600" : ""
                }`}
              >
                {fmt(outstanding)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sent + overdue invoices
              </p>
            </CardContent>
          </Card>

          {/* Upcoming jobs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming Jobs
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{upcomingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Next 7 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ROW 3 — Schedule + Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Today's Schedule */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link href="/jobs/new">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Job
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              {!todaysJobs || todaysJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No jobs scheduled for today
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-1">
                    <Link href="/jobs/new">Schedule a job</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaysJobs.map((job) => {
                    const customer = job.customers as unknown as { name: string } | null;
                    return (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">
                          {fmtTime(job.scheduled_time)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {job.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {customer?.name ?? "—"}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            JOB_STATUS_COLORS[job.status] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {job.status.replace("_", " ")}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <Wrench className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No activity yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                        {activityIcon[item.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {relativeTime(item.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ROW 4 — AR Aging Report */}
        {agingTotal > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Accounts Receivable Aging</CardTitle>
                <span className="text-sm font-semibold text-muted-foreground">{fmt(agingTotal)} total</span>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stacked bar */}
              <div className="flex h-5 rounded-full overflow-hidden mb-4 gap-px">
                {([
                  { key: "current", pct: agingTotal > 0 ? (aging.current / agingTotal) * 100 : 0,  color: "bg-green-400"  },
                  { key: "d1_30",   pct: agingTotal > 0 ? (aging.d1_30   / agingTotal) * 100 : 0,  color: "bg-yellow-400" },
                  { key: "d31_60",  pct: agingTotal > 0 ? (aging.d31_60  / agingTotal) * 100 : 0,  color: "bg-orange-400" },
                  { key: "d61_90",  pct: agingTotal > 0 ? (aging.d61_90  / agingTotal) * 100 : 0,  color: "bg-red-500"    },
                  { key: "d90plus", pct: agingTotal > 0 ? (aging.d90plus / agingTotal) * 100 : 0,  color: "bg-red-900"    },
                ] as const).filter((b) => b.pct > 0).map((bucket) => (
                  <div
                    key={bucket.key}
                    className={`${bucket.color} transition-all`}
                    style={{ width: `${bucket.pct}%` }}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {([
                  { label: "Current",   amount: aging.current, color: "bg-green-400"  },
                  { label: "1–30 days", amount: aging.d1_30,   color: "bg-yellow-400" },
                  { label: "31–60 days",amount: aging.d31_60,  color: "bg-orange-400" },
                  { label: "61–90 days",amount: aging.d61_90,  color: "bg-red-500"    },
                  { label: "90+ days",  amount: aging.d90plus, color: "bg-red-900"    },
                ] as const).map((b) => (
                  <div key={b.label} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${b.color}`} />
                      <span className="text-xs text-muted-foreground">{b.label}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{fmt(b.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROW 5 — Overdue Invoices (only shown if any exist) */}
        {overdueInvoices && overdueInvoices.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <CardTitle className="text-base text-destructive">
                  Overdue Invoices ({overdueInvoices.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map((inv) => {
                    const customer =
                      inv.customers as unknown as { name: string } | null;
                    const days = daysOverdue(inv.due_date);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell>{customer?.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(Number(inv.total ?? 0))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.due_date
                            ? new Date(inv.due_date + "T00:00:00").toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric", year: "numeric" }
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="destructive"
                            className="text-xs"
                          >
                            {days}d overdue
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            asChild
                          >
                            <Link href={`/invoices/${inv.id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
