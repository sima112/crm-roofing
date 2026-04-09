"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { saveReminderSettingsAction } from "./settings-actions";
import type { ReminderSettings } from "./reminder-defaults";
import { Bell, MessageSquare, CreditCard } from "lucide-react";

interface SettingsClientProps {
  initialSettings: ReminderSettings;
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [settings, setSettings] = useState<ReminderSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof ReminderSettings>(
    key: K,
    field: keyof ReminderSettings[K],
    value: unknown
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = () => {
    setSaving(true);
    startTransition(async () => {
      const { error } = await saveReminderSettingsAction(settings);
      setSaving(false);
      if (error) {
        toast({ title: "Save failed", description: error, variant: "destructive" });
      } else {
        toast({ title: "Settings saved", description: "Reminder preferences updated." });
      }
    });
  };

  const REMINDER_VARS: Record<keyof ReminderSettings, string[]> = {
    appointment_reminder: ["{{customer_name}}", "{{business_name}}", "{{job_title}}", "{{time}}"],
    follow_up: ["{{customer_name}}", "{{business_name}}", "{{job_title}}", "{{review_link}}"],
    payment_reminder: ["{{customer_name}}", "{{business_name}}", "{{invoice_number}}", "{{total}}", "{{payment_link}}"],
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Appointment Reminder */}
      <ReminderCard
        icon={<Bell className="w-5 h-5 text-blue-600" />}
        title="Appointment Reminder"
        description="Sent X hours before a scheduled job"
        enabled={settings.appointment_reminder.enabled}
        onToggle={(v) => update("appointment_reminder", "enabled", v)}
        template={settings.appointment_reminder.template}
        onTemplateChange={(v) => update("appointment_reminder", "template", v)}
        variables={REMINDER_VARS.appointment_reminder}
        timingLabel="Hours before appointment"
        timingValue={settings.appointment_reminder.hours_before ?? 24}
        onTimingChange={(v) => update("appointment_reminder", "hours_before", v)}
      />

      {/* Follow-Up */}
      <ReminderCard
        icon={<MessageSquare className="w-5 h-5 text-green-600" />}
        title="Follow-Up / Review Request"
        description="Sent X days after a job is marked completed"
        enabled={settings.follow_up.enabled}
        onToggle={(v) => update("follow_up", "enabled", v)}
        template={settings.follow_up.template}
        onTemplateChange={(v) => update("follow_up", "template", v)}
        variables={REMINDER_VARS.follow_up}
        timingLabel="Days after completion"
        timingValue={settings.follow_up.days_after ?? 3}
        onTimingChange={(v) => update("follow_up", "days_after", v)}
      />

      {/* Payment Reminder */}
      <ReminderCard
        icon={<CreditCard className="w-5 h-5 text-amber-600" />}
        title="Payment Reminder"
        description="Sent X days after an invoice is marked sent (if still unpaid)"
        enabled={settings.payment_reminder.enabled}
        onToggle={(v) => update("payment_reminder", "enabled", v)}
        template={settings.payment_reminder.template}
        onTemplateChange={(v) => update("payment_reminder", "template", v)}
        variables={REMINDER_VARS.payment_reminder}
        timingLabel="Days after invoice sent"
        timingValue={settings.payment_reminder.days_after ?? 7}
        onTimingChange={(v) => update("payment_reminder", "days_after", v)}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Individual reminder card ──────────────────────────────────────────────────

interface ReminderCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  template: string;
  onTemplateChange: (v: string) => void;
  variables: string[];
  timingLabel: string;
  timingValue: number;
  onTimingChange: (v: number) => void;
}

function ReminderCard({
  icon,
  title,
  description,
  enabled,
  onToggle,
  template,
  onTemplateChange,
  variables,
  timingLabel,
  timingValue,
  onTimingChange,
}: ReminderCardProps) {
  return (
    <Card className={!enabled ? "opacity-60" : undefined}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">{timingLabel}</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={timingValue}
            onChange={(e) => onTimingChange(Number(e.target.value))}
            disabled={!enabled}
            className="w-24 h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Message Template</Label>
          <Textarea
            value={template}
            onChange={(e) => onTemplateChange(e.target.value)}
            disabled={!enabled}
            rows={4}
            className="resize-none text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Available variables:{" "}
            {variables.map((v, i) => (
              <span key={v}>
                <code className="bg-muted px-1 rounded text-[11px]">{v}</code>
                {i < variables.length - 1 && " "}
              </span>
            ))}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
