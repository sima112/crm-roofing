"use client";

import Link from "next/link";
import { Wrench, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "April 10, 2026";
const VERSION      = "v1.0";

const PROCESSORS = [
  { name: "Supabase (AWS us-east-1)", role: "Database & Auth", url: "https://supabase.com/privacy" },
  { name: "Stripe",   role: "Payment processing",    url: "https://stripe.com/privacy" },
  { name: "Twilio",   role: "SMS notifications",      url: "https://www.twilio.com/en-us/legal/privacy" },
  { name: "Intuit / QuickBooks", role: "Accounting integration", url: "https://www.intuit.com/privacy/statement/" },
  { name: "OpenAI",  role: "AI assistant (CrewBot)",  url: "https://openai.com/policies/privacy-policy" },
  { name: "Vercel",  role: "Application hosting",     url: "https://vercel.com/legal/privacy-policy" },
  { name: "Resend",  role: "Transactional email",     url: "https://resend.com/legal/privacy-policy" },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-sm">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-white" />
            </div>
            CrewBooks
          </Link>
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="w-4 h-4 mr-1.5" />
            Print
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 prose prose-sm dark:prose-invert max-w-none">
        <div className="not-prose mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Version {VERSION} · Last updated {LAST_UPDATED}
          </p>
        </div>

        <p>
          CrewBooks (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the CrewBooks
          application at crewbooks.app. This Privacy Policy describes how we collect, use, and protect your
          information when you use our service.
        </p>

        <h2>1. What Data We Collect</h2>
        <h3>Account &amp; Profile Data</h3>
        <p>Name, email address, phone number, business name, trade type, and account settings.</p>

        <h3>Business Operations Data</h3>
        <p>
          Customer contact information (name, phone, email, address), job details (title, description, photos,
          status history), invoice records (line items, amounts, due dates, payment status), and payment
          transactions.
        </p>

        <h3>Usage &amp; Technical Data</h3>
        <p>
          IP addresses, browser user-agent strings, pages visited, actions taken in the app, session tokens,
          and error logs. If you consent to analytics tracking, we collect additional usage patterns to improve
          the product.
        </p>

        <h3>Communications Data</h3>
        <p>
          Records of SMS messages sent to your customers via Twilio, email messages sent via Resend, and
          AI chat conversations with CrewBot (powered by OpenAI).
        </p>

        <h2>2. Why We Collect It</h2>
        <ul>
          <li><strong>Service operation:</strong> To provide CRM, invoicing, job management, and payment features.</li>
          <li><strong>Invoicing &amp; payments:</strong> To generate PDF invoices and process payments via Stripe.</li>
          <li><strong>SMS reminders:</strong> To send automated job and invoice reminders to your customers (with your consent).</li>
          <li><strong>QuickBooks sync:</strong> To sync your data with Intuit QuickBooks when you connect it.</li>
          <li><strong>Security &amp; fraud prevention:</strong> To detect unauthorized access, rate-limit requests, and protect your account.</li>
          <li><strong>Legal compliance:</strong> To meet tax, financial, and regulatory requirements.</li>
          <li><strong>Product improvement:</strong> With your consent, to understand how the app is used and make it better.</li>
        </ul>

        <h2>3. Who We Share It With</h2>
        <p>
          We do <strong>not sell</strong> your personal data. We share data only with the sub-processors below,
          each bound by a Data Processing Agreement:
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 border">Processor</th>
                <th className="text-left p-2 border">Role</th>
                <th className="text-left p-2 border">Privacy Policy</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name}>
                  <td className="p-2 border font-medium">{p.name}</td>
                  <td className="p-2 border text-muted-foreground">{p.role}</td>
                  <td className="p-2 border">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                      Privacy Policy ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>4. Data Retention</h2>
        <ul>
          <li><strong>Active accounts:</strong> Data is retained for as long as your account is active.</li>
          <li><strong>Deleted accounts:</strong> A 30-day grace period begins on deletion. After 30 days, all personal data is permanently purged.</li>
          <li><strong>Payment records:</strong> Retained for 7 years as required by IRS regulations.</li>
          <li><strong>Security logs:</strong> Retained for 2 years for fraud detection and legal compliance.</li>
          <li><strong>AI conversations:</strong> Retained until account deletion; you can delete individual conversations at any time.</li>
        </ul>

        <h2>5. Your Rights</h2>
        <p>Under GDPR (EU/UK) and CCPA (California), you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of all data we hold about you.</li>
          <li><strong>Correction:</strong> Update inaccurate data in Settings → Profile.</li>
          <li><strong>Deletion:</strong> Delete your account and all associated data in Settings → Account.</li>
          <li><strong>Portability:</strong> Download your data as a ZIP file in Settings → Data &amp; Privacy.</li>
          <li><strong>Restriction:</strong> Request we stop processing your data in certain ways.</li>
          <li><strong>Objection:</strong> Object to processing based on legitimate interests.</li>
          <li><strong>Do Not Sell:</strong> Opt out of data sharing at{" "}
            <Link href="/privacy/opt-out" className="text-primary underline">crewbooks.app/privacy/opt-out</Link>.
          </li>
        </ul>
        <p>
          To exercise any of these rights, visit{" "}
          <Link href="/privacy/request" className="text-primary underline">our privacy request form</Link>
          {" "}or email{" "}
          <a href="mailto:privacy@crewbooks.app" className="text-primary underline">privacy@crewbooks.app</a>.
          We respond within 30 days.
        </p>

        <h2>6. Cookies</h2>
        <p>
          We use essential cookies for authentication (Supabase session) and CSRF protection. With your consent,
          we use optional cookies for analytics. You can manage cookie preferences at any time using the banner
          at the bottom of the page.
        </p>

        <h2>7. Children&apos;s Privacy</h2>
        <p>CrewBooks is not directed at children under 13. We do not knowingly collect data from children.</p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We will notify you of material changes by email and by displaying a banner in the app. Your continued
          use after the effective date constitutes acceptance. For significant changes, we will re-collect consent
          before proceeding.
        </p>

        <h2>9. Contact</h2>
        <p>
          Privacy inquiries: <a href="mailto:privacy@crewbooks.app" className="text-primary underline">privacy@crewbooks.app</a>
          <br />
          Mailing address: CrewBooks, Austin, TX, USA
        </p>

        <div className="not-prose pt-6 border-t text-xs text-muted-foreground">
          Privacy Policy {VERSION} · Effective {LAST_UPDATED} ·{" "}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </div>
      </main>
    </div>
  );
}
