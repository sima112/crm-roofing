"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  Pencil,
  Check,
  X,
  FileText,
  Plus,
  Calendar,
  Clock,
  DollarSign,
  User,
  MessageSquare,
  Phone,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoUploader } from "./photo-uploader";
import {
  updateJobFieldAction,
  changeJobStatusAction,
  sendJobSMSAction,
} from "../job-actions";
import { useToast } from "@/components/ui/use-toast";

type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

const STATUS_STYLES: Record<JobStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-500",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: ["scheduled"],
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric" }
  );
}

function fmtTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmtDate(iso);
}

// ── Inline editable title ─────────────────────────────────────────────────────

function EditableTitle({
  jobId,
  value,
}: {
  jobId: string;
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!title.trim() || title === value) {
      setTitle(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    await updateJobFieldAction(jobId, { title: title.trim() });
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-bold h-auto py-1 px-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setTitle(value); setEditing(false); }
          }}
          autoFocus
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-green-600 hover:text-green-700"
        >
          <Check className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setTitle(value); setEditing(false); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <button
      className="group flex items-center gap-2 text-left"
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
    >
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

// ── Inline editable amount ────────────────────────────────────────────────────

function EditableAmount({
  jobId,
  value,
  label,
}: {
  jobId: string;
  value: number | null;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(value != null ? String(value) : "");

  const save = async () => {
    const parsed = parseFloat(amount);
    const newVal = isNaN(parsed) ? null : parsed;
    await updateJobFieldAction(jobId, { actual_amount: newVal });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-sm">$</span>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          step="0.01"
          className="h-7 w-28 text-sm"
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      className="group flex items-center gap-1"
      onClick={() => setEditing(true)}
    >
      <span className="text-lg font-bold">
        {value != null ? fmt(Number(value)) : "—"}
      </span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Auto-save textarea ────────────────────────────────────────────────────────

function AutoSaveTextarea({
  jobId,
  field,
  value,
  placeholder,
}: {
  jobId: string;
  field: string;
  value: string;
  placeholder: string;
}) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (text === value) return;
    setSaving(true);
    await updateJobFieldAction(jobId, { [field]: text || null });
    setSaving(false);
  };

  return (
    <div className="relative">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        placeholder={placeholder}
        rows={4}
        className="resize-none"
      />
      {saving && (
        <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          Saving…
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type JobData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string | null;
  notes: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_date: string | null;
  estimated_amount: number | null;
  actual_amount: number | null;
  before_photos: string[] | null;
  after_photos: string[] | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string; phone: string | null } | null;
  business_id: string;
};

type InvoiceData = {
  id: string;
  invoice_number: string;
  status: string;
  total: number | null;
} | null;

type SMSLogEntry = {
  id: string;
  message: string;
  sent_at: string | null;
  created_at: string;
};

interface JobDetailClientProps {
  job: JobData;
  invoice: InvoiceData;
  smsLog: SMSLogEntry[];
}

export function JobDetailClient({ job, invoice, smsLog }: JobDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [statusChanging, setStatusChanging] = useState(false);
  const [invoicePromptOpen, setInvoicePromptOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState(job.customer?.phone ?? "");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);

  const status = job.status as JobStatus;
  const transitions = STATUS_TRANSITIONS[status] ?? [];

  const defaultSMSMessage = () => {
    const name = job.customer?.name ?? "there";
    if (job.status === "scheduled") {
      const dateStr = job.scheduled_date
        ? new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })
        : "soon";
      const timeStr = job.scheduled_time ? ` at ${fmtTime(job.scheduled_time)}` : "";
      return `Hi ${name}, this is a reminder that your ${job.title} appointment is scheduled for ${dateStr}${timeStr}. Reply STOP to opt out.`;
    }
    if (job.status === "in_progress") {
      return `Hi ${name}, our crew is on the way for your ${job.title}. We'll be there shortly!`;
    }
    if (job.status === "completed") {
      return `Hi ${name}, thank you for choosing us for your ${job.title}! We hope everything looks great.`;
    }
    return `Hi ${name}, this is a message regarding your ${job.title}.`;
  };

  const openSMSDialog = () => {
    setSmsPhone(job.customer?.phone ?? "");
    setSmsMessage(defaultSMSMessage());
    setSmsDialogOpen(true);
  };

  const handleSendSMS = async () => {
    if (!smsPhone.trim() || !smsMessage.trim()) return;
    setSmsSending(true);
    const { error } = await sendJobSMSAction(job.id, smsPhone.trim(), smsMessage.trim());
    setSmsSending(false);
    if (error) {
      toast({ title: "SMS failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "SMS sent!", description: "Message delivered to customer." });
      setSmsDialogOpen(false);
      startTransition(() => router.refresh());
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    setStatusChanging(true);
    await changeJobStatusAction(job.id, newStatus);
    setStatusChanging(false);

    if (newStatus === "completed" && !invoice) {
      setInvoicePromptOpen(true);
    } else {
      startTransition(() => router.refresh());
    }
  };

  // Build activity timeline from available timestamps
  type TimelineItem = { id: string; label: string; time: string };
  const timeline: TimelineItem[] = [
    { id: "created", label: "Job created", time: job.created_at },
  ];
  if (job.status === "in_progress") {
    timeline.push({ id: "started", label: "Job started", time: job.updated_at });
  }
  if (job.status === "completed" && job.completed_date) {
    timeline.push({ id: "completed", label: "Job completed", time: job.completed_date });
  }
  if (job.status === "cancelled") {
    timeline.push({ id: "cancelled", label: "Job cancelled", time: job.updated_at });
  }
  if (invoice) {
    timeline.push({
      id: "invoice",
      label: `Invoice ${invoice.invoice_number} created`,
      time: job.updated_at,
    });
    if (invoice.status === "paid") {
      timeline.push({ id: "paid", label: "Invoice paid", time: job.updated_at });
    }
  }
  for (const sms of smsLog) {
    timeline.push({
      id: `sms-${sms.id}`,
      label: `SMS sent: "${sms.message.slice(0, 60)}${sms.message.length > 60 ? "…" : ""}"`,
      time: sms.sent_at ?? sms.created_at,
    });
  }
  timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const INV_STATUS_STYLES: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-400",
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Top section */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <EditableTitle jobId={job.id} value={job.title} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status badge + change dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={statusChanging || transitions.length === 0}
                className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border cursor-pointer disabled:cursor-default disabled:opacity-70 ${
                  STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {statusChanging ? "Updating…" : status.replace("_", " ")}
                {transitions.length > 0 && <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </DropdownMenuTrigger>
            {transitions.length > 0 && (
              <DropdownMenuContent align="start">
                {transitions.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="capitalize"
                  >
                    Mark as {s.replace("_", " ")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>

          {/* Priority */}
          <span
            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              PRIORITY_STYLES[job.priority] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {job.priority}
          </span>
        </div>

        {/* Customer + date */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.customer && (
            <Link
              href={`/customers/${job.customer.id}`}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              {job.customer.name}
            </Link>
          )}
          {job.customer?.phone ? (
            <button
              onClick={openSMSDialog}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors text-teal-600"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Text Customer
            </button>
          ) : (
            job.customer && (
              <span className="flex items-center gap-1.5 text-muted-foreground/60">
                <Phone className="w-3.5 h-3.5" />
                No phone on file
              </span>
            )
          )}
          {job.scheduled_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {fmtDate(job.scheduled_date)}
            </span>
          )}
          {job.scheduled_time && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {fmtTime(job.scheduled_time)}
            </span>
          )}
          {job.scheduled_date && (
            <a
              href={`/api/jobs/${job.id}/ics`}
              download
              className="flex items-center gap-1.5 hover:text-foreground transition-colors text-teal-600"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Add to Calendar
            </a>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Estimated</p>
          <p className="text-lg font-bold">
            {job.estimated_amount != null ? fmt(Number(job.estimated_amount)) : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Actual</p>
          <EditableAmount
            jobId={job.id}
            value={job.actual_amount}
            label="Actual"
          />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Priority</p>
          <span
            className={`text-sm font-semibold capitalize ${
              PRIORITY_STYLES[job.priority]?.split(" ")[1] ?? ""
            }`}
          >
            {job.priority}
          </span>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Created</p>
          <p className="text-sm font-medium">{fmtDate(job.created_at)}</p>
        </Card>
      </div>

      {/* Description & Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Description & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <AutoSaveTextarea
              jobId={job.id}
              field="description"
              value={job.description ?? ""}
              placeholder="Describe the scope of work…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <AutoSaveTextarea
              jobId={job.id}
              field="notes"
              value={job.notes ?? ""}
              placeholder="Field notes, materials needed, access instructions…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Before & After Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <PhotoUploader
              jobId={job.id}
              businessId={job.business_id}
              type="before"
              photos={job.before_photos ?? []}
            />
            <PhotoUploader
              jobId={job.id}
              businessId={job.business_id}
              type="after"
              photos={job.after_photos ?? []}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Invoice
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoice ? (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-mono text-sm font-medium">
                  {invoice.invoice_number}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">
                    {fmt(Number(invoice.total ?? 0))}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      INV_STATUS_STYLES[invoice.status] ?? "bg-slate-100"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/invoices/${invoice.id}`}>View Invoice</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                No invoice for this job yet
              </p>
              <Button size="sm" asChild>
                <Link
                  href={`/invoices/new?job_id=${job.id}&customer_id=${job.customer?.id ?? ""}`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create Invoice
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {timeline.map((item, i) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  {i < timeline.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4">
                  <p className="text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {relTime(item.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Text Customer dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              Text Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+15125550100"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={5}
                className="resize-none text-sm"
                placeholder="Type your message…"
              />
              <p className="text-xs text-muted-foreground text-right">
                {smsMessage.length} chars
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setSmsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendSMS}
                disabled={smsSending || !smsPhone.trim() || !smsMessage.trim()}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                {smsSending ? "Sending…" : "Send SMS"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Create invoice?" prompt after marking complete */}
      <Dialog open={invoicePromptOpen} onOpenChange={setInvoicePromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Job Completed!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create an invoice for this job now?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  setInvoicePromptOpen(false);
                  router.push(
                    `/invoices/new?job_id=${job.id}&customer_id=${job.customer?.id ?? ""}`
                  );
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Invoice
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInvoicePromptOpen(false);
                  startTransition(() => router.refresh());
                }}
              >
                Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
