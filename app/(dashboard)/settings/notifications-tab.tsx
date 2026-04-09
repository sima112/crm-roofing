"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Bell, MessageSquare, CreditCard } from "lucide-react";
import { saveReminderSettingsAction } from "./settings-actions";
import type { ReminderSettings } from "./reminder-defaults";

interface NotificationsTabProps {
  initialSettings: ReminderSettings;
}

export function NotificationsTab({ initialSettings }: NotificationsTabProps) {
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
        toast({ title: "Notification settings saved" });
      }
    });
  };

  const VARS: Record<keyof ReminderSettings, string> = {
    appointment_reminder: "{{customer_name}}, {{business_name}}, {{job_title}}, {{time}}",
    follow_up: "{{customer_name}}, {{business_name}}, {{job_title}}, {{review_link}}",
    payment_reminder: "{{customer_name}}, {{business_name}}, {{invoice_number}}, {{total}}, {{payment_link}}",
  };

  const twilioNote = (
    <p className="text-sm text-muted-foreground rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-6">
      SMS reminders require{" "}
      <code className="text-xs bg-amber-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>,{" "}
      <code className="text-xs bg-amber-100 px-1 rounded">TWILIO_AUTH_TOKEN</code>, and{" "}
      <code className="text-xs bg-amber-100 px-1 rounded">TWILIO_PHONE_NUMBER</code>{" "}
      in <code className="text-xs bg-amber-100 px-1 rounded">.env.local</code>.
    </p>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {twilioNote}

      <ReminderCard
        icon={<Bell className="w-4 h-4 text-blue-600" />}
        title="Appointment Reminder"
        description="Sent before a scheduled job"
        enabled={settings.appointment_reminder.enabled}
        onToggle={(v) => update("appointment_reminder", "enabled", v)}
        template={settings.appointment_reminder.template}
        onTemplateChange={(v) => update("appointment_reminder", "template", v)}
        vars={VARS.appointment_reminder}
        timingLabel="Hours before appointment"
        timingValue={settings.appointment_reminder.hours_before ?? 24}
        onTimingChange={(v) => update("appointment_reminder", "hours_before", v)}
      />

      <ReminderCard
        icon={<MessageSquare className="w-4 h-4 text-green-600" />}
        title="Follow-Up / Review Request"
        description="Sent after a job is marked completed"
        enabled={settings.follow_up.enabled}
        onToggle={(v) => update("follow_up", "enabled", v)}
        template={settings.follow_up.template}
        onTemplateChange={(v) => update("follow_up", "template", v)}
        vars={VARS.follow_up}
        timingLabel="Days after completion"
        timingValue={settings.follow_up.days_after ?? 3}
        onTimingChange={(v) => update("follow_up", "days_after", v)}
      />

      <ReminderCard
        icon={<CreditCard className="w-4 h-4 text-amber-600" />}
        title="Payment Reminder"
        description="Sent if an invoice is unpaid after being sent"
        enabled={settings.payment_reminder.enabled}
        onToggle={(v) => update("payment_reminder", "enabled", v)}
        template={settings.payment_reminder.template}
        onTemplateChange={(v) => update("payment_reminder", "template", v)}
        vars={VARS.payment_reminder}
        timingLabel="Days after invoice sent"
        timingValue={settings.payment_reminder.days_after ?? 7}
        onTimingChange={(v) => update("payment_reminder", "days_after", v)}
      />

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Notifications"}
      </Button>
    </div>
  );
}

// ── Reminder card ─────────────────────────────────────────────────────────────

interface ReminderCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  template: string;
  onTemplateChange: (v: string) => void;
  vars: string;
  timingLabel: string;
  timingValue: number;
  onTimingChange: (v: number) => void;
}

function ReminderCard({
  icon, title, description, enabled, onToggle,
  template, onTemplateChange, vars, timingLabel, timingValue, onTimingChange,
}: ReminderCardProps) {
  return (
    <Card className={!enabled ? "opacity-60" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm shrink-0">{timingLabel}</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={timingValue}
            onChange={(e) => onTimingChange(Number(e.target.value))}
            disabled={!enabled}
            className="w-20 h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Message Template</Label>
          <Textarea
            value={template}
            onChange={(e) => onTemplateChange(e.target.value)}
            disabled={!enabled}
            rows={3}
            className="resize-none text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Variables: <span className="font-mono text-[11px]">{vars}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
