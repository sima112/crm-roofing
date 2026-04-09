// Shared types and defaults for reminder settings (no server directive)

export type ReminderConfig = {
  enabled: boolean;
  template: string;
  hours_before?: number;
  days_after?: number;
};

export type ReminderSettings = {
  appointment_reminder: ReminderConfig;
  follow_up: ReminderConfig;
  payment_reminder: ReminderConfig;
};

export const DEFAULT_SETTINGS: ReminderSettings = {
  appointment_reminder: {
    enabled: true,
    hours_before: 24,
    template:
      "Hi {{customer_name}}, this is a reminder from {{business_name}} that your {{job_title}} appointment is tomorrow at {{time}}. Reply STOP to opt out.",
  },
  follow_up: {
    enabled: true,
    days_after: 3,
    template:
      "Hi {{customer_name}}, {{business_name}} here. We hope you're happy with your {{job_title}}! If you have a moment, we'd love a Google review: {{review_link}}. Thank you!",
  },
  payment_reminder: {
    enabled: true,
    days_after: 7,
    template:
      "Hi {{customer_name}}, friendly reminder that invoice {{invoice_number}} for {{total}} from {{business_name}} is due. Pay online: {{payment_link}}",
  },
};
