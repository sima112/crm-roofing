"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { saveLateFeeSettingsAction, type LateFeeSettings } from "./settings-actions";
import { AlertCircle, DollarSign, Percent, Clock } from "lucide-react";

interface LateFeesTabProps {
  initialSettings: LateFeeSettings;
}

export function LateFeesTab({ initialSettings }: LateFeesTabProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [settings, setSettings] = useState<LateFeeSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    startTransition(async () => {
      const { error } = await saveLateFeeSettingsAction(settings);
      setSaving(false);
      if (error) {
        toast({ title: "Save failed", description: error, variant: "destructive" });
      } else {
        toast({ title: "Late fee settings saved" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automatic Late Fees</CardTitle>
          <CardDescription>
            Automatically add a late fee to overdue invoices after a grace period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Enable toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enable Late Fees</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Apply a fee when invoices become overdue past the grace period
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
          </div>

          {settings.enabled && (
            <>
              {/* Fee type */}
              <div className="space-y-2">
                <Label>Fee Type</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, type: "flat" }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      settings.type === "flat"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:border-primary"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Flat Fee
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, type: "percentage" }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      settings.type === "percentage"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input text-muted-foreground hover:border-primary"
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    Percentage
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label>
                  {settings.type === "flat" ? "Late Fee Amount ($)" : "Late Fee Rate (%)"}
                </Label>
                <div className="relative max-w-[180px]">
                  <span className="absolute left-3 top-2 text-sm text-muted-foreground">
                    {settings.type === "flat" ? "$" : ""}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step={settings.type === "flat" ? "1" : "0.1"}
                    className={settings.type === "flat" ? "pl-7" : ""}
                    value={settings.amount}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, amount: parseFloat(e.target.value) || 0 }))
                    }
                  />
                  {settings.type === "percentage" && (
                    <span className="absolute right-3 top-2 text-sm text-muted-foreground">%</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.type === "flat"
                    ? "A fixed dollar amount added to the invoice total"
                    : "A percentage of the invoice total (e.g. 1.5% on $5,000 = $75)"}
                </p>
              </div>

              {/* Grace period */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Grace Period (days)
                </Label>
                <div className="flex items-center gap-2 max-w-[180px]">
                  <Input
                    type="number"
                    min="0"
                    max="90"
                    value={settings.grace_period_days}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, grace_period_days: parseInt(e.target.value) || 0 }))
                    }
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">days</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Days after the due date before the late fee applies (default: 7)
                </p>
              </div>

              {/* Max late fee */}
              {settings.type === "percentage" && (
                <div className="space-y-1.5">
                  <Label>Maximum Late Fee ($) <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative max-w-[180px]">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="pl-7"
                      placeholder="No cap"
                      value={settings.max_late_fee || ""}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          max_late_fee: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cap the late fee at this amount (0 = no cap)
                  </p>
                </div>
              )}

              {/* Preview */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Example</p>
                    <p className="mt-1">
                      For a $5,000 invoice:{" "}
                      {settings.type === "flat"
                        ? `a flat $${settings.amount.toFixed(2)} late fee will be added`
                        : `a ${settings.amount}% late fee = $${((5000 * settings.amount) / 100).toFixed(2)}${
                            settings.max_late_fee > 0 ? `, capped at $${settings.max_late_fee}` : ""
                          }`}
                      , applied {settings.grace_period_days} day{settings.grace_period_days !== 1 ? "s" : ""} after the due date.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Saving…" : "Save Late Fee Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
