"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createJobAction, type JobFormState } from "./job-actions";

interface CustomerOption { id: string; name: string }

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating…" : "Create Job"}
    </Button>
  );
}

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string; // YYYY-MM-DD
  defaultCustomerId?: string;
}

export function AddJobDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultCustomerId,
}: AddJobDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load customers on open
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("customers")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setCustomers(data ?? []);
        // Pre-select if defaultCustomerId provided
        if (defaultCustomerId && data) {
          const found = data.find((c) => c.id === defaultCustomerId);
          if (found) setSelectedCustomer(found);
        }
      });
  }, [open, defaultCustomerId]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const wrappedAction = async (prev: JobFormState, formData: FormData) => {
    if (selectedCustomer) formData.set("customer_id", selectedCustomer.id);
    const result = await createJobAction(prev, formData);
    if (result.success) {
      onOpenChange(false);
      setSearch("");
      setSelectedCustomer(null);
      startTransition(() => router.refresh());
      if (result.id) router.push(`/jobs/${result.id}`);
    }
    return result;
  };

  const [state, formAction] = useActionState(wrappedAction, {
    error: null,
    success: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* Customer picker */}
          <div className="space-y-1.5">
            <Label>
              Customer <span className="text-destructive">*</span>
            </Label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                <span>{selectedCustomer.name}</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Search customers…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                />
                {showDropdown && filtered.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {filtered.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onMouseDown={() => {
                          setSelectedCustomer(c);
                          setSearch("");
                          setShowDropdown(false);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Job Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="3-tab shingle replacement — 2,400 sq ft"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Scope of work…"
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_date">Date</Label>
              <Input
                id="scheduled_date"
                name="scheduled_date"
                type="date"
                defaultValue={defaultDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_time">Time</Label>
              <Input
                id="scheduled_time"
                name="scheduled_time"
                type="time"
              />
            </div>
          </div>

          {/* Priority + Estimated Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                defaultValue="normal"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimated_amount">Est. Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                <Input
                  id="estimated_amount"
                  name="estimated_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-6"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {state.error && (
            <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
          )}

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
