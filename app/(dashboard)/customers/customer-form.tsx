"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/types/database";

const TAG_OPTIONS = ["residential", "commercial", "repeat"];
const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "google", label: "Google" },
  { value: "facebook", label: "Facebook" },
  { value: "door-knock", label: "Door Knock" },
  { value: "other", label: "Other" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

interface CustomerFormProps {
  action: (prev: { error: string | null; success: boolean }, formData: FormData) => Promise<{ error: string | null; success: boolean }>;
  defaultValues?: Partial<Customer>;
  submitLabel?: string;
  onSuccess: () => void;
}

export function CustomerForm({
  action,
  defaultValues,
  submitLabel = "Save Customer",
  onSuccess,
}: CustomerFormProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    defaultValues?.tags ?? []
  );

  const wrappedAction = async (
    prev: { error: string | null; success: boolean },
    formData: FormData
  ) => {
    formData.set("tags", selectedTags.join(","));
    const result = await action(prev, formData);
    if (result.success) onSuccess();
    return result;
  };

  const [state, formAction] = useActionState(wrappedAction, {
    error: null,
    success: false,
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          placeholder="Mike Torres"
        />
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultValues?.phone ?? ""}
            placeholder="(512) 555-0100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            placeholder="mike@example.com"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          placeholder="4821 Shoal Creek Blvd"
        />
      </div>

      {/* City / State / ZIP */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={defaultValues?.city ?? ""}
            placeholder="Austin"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            name="state"
            defaultValue={defaultValues?.state ?? "TX"}
            placeholder="TX"
            maxLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            name="zip"
            defaultValue={defaultValues?.zip ?? ""}
            placeholder="78756"
          />
        </div>
      </div>

      {/* Source */}
      <div className="space-y-1.5">
        <Label htmlFor="source">Source</Label>
        <select
          id="source"
          name="source"
          defaultValue={defaultValues?.source ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select source…</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <div className="flex gap-2 flex-wrap">
          {TAG_OPTIONS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
          placeholder="Any notes about this customer…"
        />
      </div>

      {state.error && (
        <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{state.error}</p>
        </div>
      )}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
