import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
  }
  return _resend;
}

export const resendConfigured = !!(
  process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder"
);

/** Convenience wrapper — silently no-ops if Resend is not configured. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  if (!resendConfigured) return;
  const resend = getResend();
  await resend.emails.send({
    from: opts.from ?? "CrewBooks <noreply@crewbooks.app>",
    to:   opts.to,
    subject: opts.subject,
    html:    opts.html,
  });
}
