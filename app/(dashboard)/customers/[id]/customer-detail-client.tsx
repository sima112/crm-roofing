"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  Plus,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CustomerForm } from "../customer-form";
import {
  updateCustomerAction,
  deleteCustomerAction,
  updateCustomerNotesAction,
  type CustomerFormState,
} from "../customer-actions";
import type { Customer } from "@/types/database";
import { QBOSyncButton } from "@/components/qbo-sync-button";

const JOB_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const INV_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-400",
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type JobRow = {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  actual_amount: number | null;
  estimated_amount: number | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total: number | null;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
};

interface CustomerDetailClientProps {
  customer: Customer;
  jobs: JobRow[];
  invoices: InvoiceRow[];
  showQBO?: boolean;
}

export function CustomerDetailClient({
  customer,
  jobs,
  invoices,
  showQBO = false,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullAddress = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");

  const mapsUrl = fullAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`
    : null;

  const handleEditSuccess = () => {
    setEditOpen(false);
    startTransition(() => router.refresh());
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await deleteCustomerAction(customer.id);
    if (error) {
      setDeleteError(error);
      setDeleting(false);
    } else {
      router.push("/customers");
      router.refresh();
    }
  };

  const handleNotesBlur = async () => {
    if (notes === (customer.notes ?? "")) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setNotesSaving(true);
    await updateCustomerNotesAction(customer.id, notes);
    setNotesSaving(false);
  };

  // Update action bound to this customer's id
  const updateAction = async (
    prev: CustomerFormState,
    formData: FormData
  ) => updateCustomerAction(customer.id, formData);

  // Build activity timeline
  type TimelineItem = { id: string; label: string; time: string };
  const timeline: TimelineItem[] = [
    {
      id: "created",
      label: "Customer added",
      time: customer.created_at,
    },
    ...jobs.map((j) => ({
      id: `j-${j.id}`,
      label: `Job created: ${j.title}`,
      time: j.created_at,
    })),
    ...jobs
      .filter((j) => j.status === "completed" && j.completed_date)
      .map((j) => ({
        id: `jc-${j.id}`,
        label: `Job completed: ${j.title}`,
        time: j.completed_date!,
      })),
    ...invoices.map((inv) => ({
      id: `inv-${inv.id}`,
      label: `Invoice ${inv.invoice_number} created`,
      time: inv.created_at,
    })),
    ...invoices
      .filter((inv) => inv.status === "paid" && inv.paid_date)
      .map((inv) => ({
        id: `invp-${inv.id}`,
        label: `Invoice ${inv.invoice_number} paid — ${fmt(Number(inv.total ?? 0))}`,
        time: inv.paid_date!,
      })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {customer.phone}
              </a>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {customer.email}
              </a>
            )}
            {fullAddress && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{fullAddress}</span>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                    title="Open in Google Maps"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </span>
            )}
          </div>
          {customer.tags && customer.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap pt-0.5">
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="capitalize text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap">
          {showQBO && (
            <QBOSyncButton
              type="customer"
              id={customer.id}
              syncStatus={(customer as unknown as { qbo_customer_id?: string }).qbo_customer_id ? "synced" : null}
              syncedAt={(customer as unknown as { qbo_synced_at?: string }).qbo_synced_at ?? null}
            />
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">
            Jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes & History</TabsTrigger>
        </TabsList>

        {/* Jobs tab */}
        <TabsContent value="jobs" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" asChild>
              <Link href={`/jobs/new?customer_id=${customer.id}`}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Job
              </Link>
            </Button>
          </div>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground">No jobs yet — create the first one</p>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/jobs/new?customer_id=${customer.id}`}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Schedule Job
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const date = job.completed_date ?? job.scheduled_date;
                    return (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/jobs/${job.id}`)}
                      >
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {date
                            ? new Date(date + (date.length === 10 ? "T00:00:00" : ""))
                                .toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate">
                          {job.title}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              JOB_STATUS_COLORS[job.status] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {job.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {job.actual_amount != null
                            ? fmt(Number(job.actual_amount))
                            : job.estimated_amount != null
                            ? `~${fmt(Number(job.estimated_amount))}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Invoices tab */}
        <TabsContent value="invoices" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" asChild>
              <Link href={`/invoices/new?customer_id=${customer.id}`}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Invoice
              </Link>
            </Button>
          </div>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground">No invoices yet</p>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/invoices/new?customer_id=${customer.id}`}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create Invoice
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {inv.invoice_number}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            INV_STATUS_COLORS[inv.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {fmt(Number(inv.total ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Notes & History tab */}
        <TabsContent value="notes" className="mt-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Notes</label>
              {notesSaving && (
                <span className="text-xs text-muted-foreground">Saving…</span>
              )}
            </div>
            <Textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this customer…"
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Auto-saves when you click away
            </p>
          </div>

          {/* Activity timeline */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">History</h3>
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
                      {relativeTime(item.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            action={updateAction}
            defaultValues={customer}
            submitLabel="Save Changes"
            onSuccess={handleEditSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {customer.name}
              </span>
              ? This will also delete all their jobs, invoices, and reminders.
              This action cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
