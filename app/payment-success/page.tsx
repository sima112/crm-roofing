import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Payment Received — CrewBooks" };

// Public page — no auth required. Customer lands here after paying via Stripe.
export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border p-8 sm:p-12 max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Payment Received!</h1>
          <p className="text-muted-foreground">
            Thank you — your payment has been processed successfully.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 border p-4 text-sm text-muted-foreground">
          A receipt has been sent to your email address. If you have any
          questions, please contact the business directly.
        </div>

        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-semibold text-teal-600">CrewBooks</span>
        </p>
      </div>
    </main>
  );
}
