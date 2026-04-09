// SMS utility — wraps Twilio. Full Twilio setup in Prompt 3.2.
// This interface is called from invoice actions now; the Twilio client
// is wired up in the next prompt.

export interface SendSMSParams {
  to: string;       // E.164 format, e.g. +15125550100
  body: string;
}

export async function sendSMS({ to, body }: SendSMSParams): Promise<{ error: string | null }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || accountSid === "your-sid" ||
      !authToken  || authToken  === "your-token" ||
      !from       || from       === "+1xxxxxxxxxx") {
    // Twilio not yet configured — log and return gracefully
    console.warn("[sendSMS] Twilio not configured. Message would have been:", { to, body });
    return { error: null }; // don't crash the caller
  }

  try {
    // Dynamic import so Twilio SDK doesn't break the build when unconfigured
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ to, from, body });
    return { error: null };
  } catch (err) {
    console.error("[sendSMS] Twilio error:", err);
    return { error: err instanceof Error ? err.message : "SMS failed" };
  }
}
