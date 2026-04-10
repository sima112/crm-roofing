"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { submitPrivacyRequest, type PrivacyRequestType } from "@/lib/gdpr";
import { sendEmail } from "@/lib/resend";
import { headers } from "next/headers";

export type PrivacyRequestState = { error: string | null; success: boolean };

export async function submitPrivacyRequestAction(
  _prevState: PrivacyRequestState,
  formData: FormData
): Promise<PrivacyRequestState> {
  const fullName    = (formData.get("fullName") as string)?.trim();
  const email       = (formData.get("email") as string)?.trim();
  const requestType = formData.get("requestType") as string;
  const notes       = (formData.get("notes") as string)?.trim() || undefined;

  if (!fullName || !email || !requestType) {
    return { error: "All required fields must be filled.", success: false };
  }

  const validTypes = ["access", "correction", "deletion", "portability", "opt_out"];
  if (!validTypes.includes(requestType)) {
    return { error: "Invalid request type.", success: false };
  }

  const hdrs = await headers();
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const admin = createAdminClient();

  try {
    await submitPrivacyRequest(admin, {
      fullName,
      email,
      requestType: requestType as PrivacyRequestType,
      notes,
      ipAddress,
    });
  } catch {
    return { error: "Failed to submit request. Please try again.", success: false };
  }

  // Send acknowledgment email within 5 seconds
  const requestLabels: Record<string, string> = {
    access:      "Data Access",
    correction:  "Data Correction",
    deletion:    "Data Deletion",
    portability: "Data Portability",
    opt_out:     "Do Not Sell / Opt-Out",
  };

  await sendEmail({
    to:      email,
    subject: `Privacy Request Received — ${requestLabels[requestType] ?? requestType}`,
    html: `
      <p>Hi ${fullName},</p>
      <p>We have received your <strong>${requestLabels[requestType] ?? requestType}</strong> request.</p>
      <p>We will respond within <strong>30 days</strong> as required by GDPR and CCPA.</p>
      <p>Your request reference: submitted on ${new Date().toDateString()}.</p>
      <p>If you have questions, reply to this email or contact us at
         <a href="mailto:privacy@crewbooks.app">privacy@crewbooks.app</a>.</p>
      <p>— The CrewBooks Privacy Team</p>
    `,
  }).catch(() => {});

  return { error: null, success: true };
}
