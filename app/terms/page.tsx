"use client";

import Link from "next/link";
import { Wrench, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "April 10, 2026";
const VERSION      = "v1.0";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Version {VERSION} · Last updated {LAST_UPDATED}
          </p>
        </div>

        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of CrewBooks (&ldquo;Service&rdquo;),
          operated by CrewBooks (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account, you agree to
          these Terms.
        </p>

        <h2>1. Service Description</h2>
        <p>
          CrewBooks is a cloud-based CRM and invoicing platform for small trade contractors (roofing, HVAC,
          plumbing, electrical, landscaping, and general contracting). Features include customer management,
          job tracking, invoice creation and delivery, SMS reminders, QuickBooks integration, and an AI
          assistant (CrewBot).
        </p>

        <h2>2. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal purpose or in violation of applicable law.</li>
          <li>Upload malware, spam, or abusive content.</li>
          <li>Attempt to gain unauthorized access to any part of the Service.</li>
          <li>Resell or sublicense the Service without written permission.</li>
          <li>Use the AI assistant (CrewBot) to generate content that is fraudulent, harassing, or illegal.</li>
          <li>Send SMS messages to individuals who have not consented to receive them.</li>
        </ul>

        <h2>3. Account Registration</h2>
        <p>
          You must provide accurate information when creating an account. You are responsible for maintaining
          the confidentiality of your credentials and for all activity under your account. Notify us immediately
          at <a href="mailto:support@crewbooks.app" className="text-primary underline">support@crewbooks.app</a> if
          you suspect unauthorized access.
        </p>

        <h2>4. Subscription &amp; Payment Terms</h2>
        <h3>Free Trial</h3>
        <p>
          New accounts start with a free trial. No credit card is required during the trial period.
        </p>
        <h3>Paid Plans</h3>
        <p>
          After the trial, continued use requires a paid subscription. Prices are listed at
          crewbooks.app/pricing. Subscriptions are billed monthly or annually, in advance. All fees are in USD.
        </p>
        <h3>Failed Payments</h3>
        <p>
          If a payment fails, we will retry for 7 days. After 7 days without payment, your account will be
          suspended (read-only). Data is retained for 30 days before deletion.
        </p>

        <h2>5. Refund Policy</h2>
        <p>
          Monthly subscriptions: no refunds for partial months. Annual subscriptions: pro-rated refund for
          unused months if cancelled within the first 30 days. No refunds after 30 days on annual plans.
          Contact <a href="mailto:support@crewbooks.app" className="text-primary underline">support@crewbooks.app</a> to
          request a refund.
        </p>

        <h2>6. Intellectual Property</h2>
        <p>
          The Service and its original content (excluding your data) are and remain the exclusive property of
          CrewBooks. You retain full ownership of all data you enter into the Service.
        </p>

        <h2>7. Data &amp; Privacy</h2>
        <p>
          Your use of the Service is also governed by our{" "}
          <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>, which is incorporated
          into these Terms by reference.
        </p>

        <h2>8. Third-Party Integrations</h2>
        <p>
          The Service integrates with third-party services (Stripe, Twilio, QuickBooks, OpenAI). Your use of
          those integrations is also subject to their respective terms of service. We are not responsible for
          third-party service outages or changes.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CREWBOOKS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
          AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          INCLUDING LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
        </p>
        <p>
          OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL NOT EXCEED THE
          GREATER OF (A) $100 OR (B) THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.
        </p>

        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless CrewBooks from any claims, damages, liabilities,
          costs, and expenses (including attorneys&apos; fees) arising from your use of the Service, your violation
          of these Terms, or your infringement of any third-party rights.
        </p>

        <h2>11. Warranty Disclaimer</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
          NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF
          VIRUSES.
        </p>

        <h2>12. Termination</h2>
        <p>
          Either party may terminate at any time. We may suspend or terminate your account immediately if you
          violate these Terms. Upon termination, your right to use the Service ceases. Your data will be retained
          for 30 days and then permanently deleted.
        </p>

        <h2>13. Governing Law &amp; Dispute Resolution</h2>
        <p>
          These Terms are governed by the laws of the State of Texas, USA, without regard to conflict-of-law
          provisions. Any disputes shall be resolved in the state or federal courts located in Travis County, Texas.
          You waive any objection to such jurisdiction.
        </p>

        <h2>14. Changes to Terms</h2>
        <p>
          We may update these Terms at any time. We will notify you of material changes by email at least 14 days
          before they take effect. Continued use after the effective date constitutes acceptance.
        </p>

        <h2>15. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:legal@crewbooks.app" className="text-primary underline">legal@crewbooks.app</a>
        </p>

        <div className="not-prose pt-6 border-t text-xs text-muted-foreground">
          Terms of Service {VERSION} · Effective {LAST_UPDATED} ·{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
