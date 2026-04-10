"use client";

import { useState, useEffect, useTransition } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceFormState, LineItem } from "./invoice-actions";

type CustomerOption = { id: string; name: string };
type JobOption = { id: string; title: string; estimated_amount: number | null };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="flex-1">
      {pending ? "Saving…" : label}
    </Button>
  );
}

export interface InvoiceFormDefaults {
  customer_id:       string;
  job_id?:           string | null;
  due_date?:         string | null;
  notes?:            string | null;
  line_items?:       LineItem[];
  deposit_required?: boolean;
  deposit_amount?:   number | null;
  recurring?:        boolean;
  recurring_interval?: string | null;
  recurring_end_date?: string | null;
}

interface InvoiceFormProps {
  action: (prev: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
  defaultCustomerId?: string;
  defaultJobId?: string;
  defaultValues?: InvoiceFormDefaults;
}

export function InvoiceForm({
  action,
  defaultCustomerId,
  defaultJobId,
  defaultValues,
}: InvoiceFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    defaultValues?.customer_id ?? defaultCustomerId ?? ""
  );
  const [selectedJobId, setSelectedJobId] = useState(
    defaultValues?.job_id ?? defaultJobId ?? ""
  );
  const [sendNow, setSendNow] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>(
    defaultValues?.line_items && defaultValues.line_items.length > 0
      ? defaultValues.line_items
      : [{ description: "", quantity: 1, unit_price: 0, amount: 0 }]
  );

  // ── Deposit state ─────────────────────────────────────────────────────────
  const [depositEnabled, setDepositEnabled] = useState(defaultValues?.deposit_required ?? false);
  const [depositPct, setDepositPct] = useState(50); // percent of total for quick-set
  const [depositAmtStr, setDepositAmtStr] = useState(
    defaultValues?.deposit_amount != null ? String(defaultValues.deposit_amount) : ""
  );

  // ── Recurring state ───────────────────────────────────────────────────────
  const [recurringEnabled, setRecurringEnabled] = useState(defaultValues?.recurring ?? false);
  const [recurringInterval, setRecurringInterval] = useState(defaultValues?.recurring_interval ?? "monthly");
  const [recurringEndDate, setRecurringEndDate] = useState(defaultValues?.recurring_end_date ?? "");

  // Load customers
  useEffect(() => {
    createClient()
      .from("customers")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCustomers(data ?? []));
  }, []);

  // Load jobs when customer changes
  useEffect(() => {
    if (!selectedCustomerId) { setJobs([]); return; }
    createClient()
      .from("jobs")
      .select("id, title, estimated_amount")
      .eq("customer_id", selectedCustomerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setJobs(data ?? []));
  }, [selectedCustomerId]);

  // Pre-fill line item from job's estimated_amount
  useEffect(() => {
    if (!selectedJobId) return;
    const job = jobs.find((j) => j.id === selectedJobId);
    if (!job?.estimated_amount) return;
    if (lineItems.length === 1 && !lineItems[0].description && lineItems[0].unit_price === 0) {
      setLineItems([{
        description: job.title,
        quantity: 1,
        unit_price: Number(job.estimated_amount),
        amount: Number(job.estimated_amount),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, jobs]);

  const updateLine = (i: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => {
      const rows = [...prev];
      const row = { ...rows[i] };
      if (field === "description") row.description = value;
      if (field === "quantity")    row.quantity  = Math.max(0, parseFloat(value) || 0);
      if (field === "unit_price")  row.unit_price = Math.max(0, parseFloat(value) || 0);
      row.amount = row.quantity * row.unit_price;
      rows[i] = row;
      return rows;
    });
  };

  const addLine   = () => setLineItems((p) => [...p, { description: "", quantity: 1, unit_price: 0, amount: 0 }]);
  const removeLine = (i: number) => setLineItems((p) => p.filter((_, idx) => idx !== i));

  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const taxRate  = 0.0825;
  const tax      = subtotal * taxRate;
  const total    = subtotal + tax;

  // Sync deposit amount when pct changes
  useEffect(() => {
    if (depositEnabled && !depositAmtStr) {
      setDepositAmtStr((total * depositPct / 100).toFixed(2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, depositPct, depositEnabled]);

  const depositAmount = parseFloat(depositAmtStr) || 0;
  const balanceAmount = Math.max(0, total - depositAmount);

  const wrappedAction = async (prev: InvoiceFormState, formData: FormData) => {
    formData.set("line_items",        JSON.stringify(lineItems));
    formData.set("customer_id",       selectedCustomerId);
    if (selectedJobId) formData.set("job_id", selectedJobId);
    formData.set("send_now",          String(sendNow));
    formData.set("deposit_required",  String(depositEnabled));
    formData.set("deposit_amount",    depositEnabled ? String(depositAmount) : "0");
    formData.set("recurring",         String(recurringEnabled));
    formData.set("recurring_interval", recurringInterval);
    formData.set("recurring_end_date", recurringEndDate || "");
    const result = await action(prev, formData);
    if (result.success) {
      startTransition(() => router.refresh());
    }
    return result;
  };

  const [state, formAction] = useActionState(wrappedAction, { error: null, success: false });

  return (
    <form action={formAction} className="space-y-6">
      {/* Customer + Job */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="customer_id">
            Customer <span className="text-destructive">*</span>
          </Label>
          <select
            id="customer_id"
            name="customer_id"
            required
            value={selectedCustomerId}
            onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedJobId(""); }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job_id">Job (optional)</Label>
          <select
            id="job_id"
            name="job_id"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            disabled={!selectedCustomerId}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">No job linked</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Due date */}
      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="due_date">Due Date</Label>
        <Input
          id="due_date"
          name="due_date"
          type="date"
          defaultValue={defaultValues?.due_date ?? defaultDueDate()}
        />
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <Label>Line Items</Label>
        <div className="rounded-xl border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_80px_100px_100px_40px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Unit Price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_100px_40px] gap-2 px-3 py-2 border-t first:border-t-0 items-center">
              <Input
                value={li.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
                placeholder="Description of work…"
                className="h-8 text-sm"
              />
              <Input
                value={li.quantity === 0 ? "" : String(li.quantity)}
                onChange={(e) => updateLine(i, "quantity", e.target.value)}
                type="number" min="0" step="any" placeholder="1"
                className="h-8 text-sm text-center"
              />
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-sm text-muted-foreground">$</span>
                <Input
                  value={li.unit_price === 0 ? "" : String(li.unit_price)}
                  onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                  type="number" min="0" step="0.01" placeholder="0.00"
                  className="h-8 text-sm pl-6 text-right"
                />
              </div>
              <div className="text-sm font-medium text-right py-1 pr-1 tabular-nums">{fmt(li.amount)}</div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lineItems.length === 1}
                className="text-muted-foreground hover:text-destructive disabled:opacity-30 justify-self-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Line Item
        </Button>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (8.25%)</span>
            <span className="tabular-nums">{fmt(tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1.5 border-t">
            <span>Total</span>
            <span className="text-primary tabular-nums">{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Deposit ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Require Deposit</p>
              <p className="text-xs text-muted-foreground">Split into deposit + balance payment</p>
            </div>
          </div>
          <Switch
            checked={depositEnabled}
            onCheckedChange={(v) => {
              setDepositEnabled(v);
              if (v && !depositAmtStr) {
                setDepositAmtStr((total * depositPct / 100).toFixed(2));
              }
            }}
          />
        </div>

        {depositEnabled && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs">Quick set:</Label>
              {[25, 50, 75].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDepositPct(p);
                    setDepositAmtStr((total * p / 100).toFixed(2));
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    Math.abs(depositAmount - total * p / 100) < 0.01
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-muted-foreground hover:border-primary"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Deposit Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    className="pl-7 h-8 text-sm"
                    value={depositAmtStr}
                    onChange={(e) => setDepositAmtStr(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Balance Due</Label>
                <div className="h-8 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-medium tabular-nums text-muted-foreground">
                  {fmt(balanceAmount)}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Two Stripe payment links will be generated: one for the deposit, one for the balance.
            </p>
          </div>
        )}
      </div>

      {/* ── Recurring ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Make Recurring</p>
              <p className="text-xs text-muted-foreground">Auto-generate the next invoice when this one is paid</p>
            </div>
          </div>
          <Switch
            checked={recurringEnabled}
            onCheckedChange={setRecurringEnabled}
          />
        </div>

        {recurringEnabled && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Interval</Label>
                <Select value={recurringInterval} onValueChange={setRecurringInterval}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly (every 3 months)</SelectItem>
                    <SelectItem value="semi_annual">Semi-Annual (every 6 months)</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              After payment, a new invoice will be automatically scheduled for the next interval.
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
          placeholder="Payment terms, thank-you message, warranty info…"
        />
      </div>

      {state.error && (
        <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{state.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="outline"
          className="flex-1"
          onClick={() => setSendNow(false)}
        >
          Save as Draft
        </Button>
        <SubmitButton label="Save & Send" />
      </div>
    </form>
  );
}
