import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wrench } from "lucide-react";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Logo mark */}
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <span className="text-4xl font-bold text-white tracking-tight">
            CrewBooks
          </span>
        </div>

        <p className="text-xl text-slate-300 leading-relaxed">
          Dead-simple CRM for roofing and HVAC crews
        </p>

        <p className="text-slate-400 text-base">
          Track customers, schedule jobs, send invoices, and collect payments —
          all from your phone on the job site.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-primary/90 transition-colors"
          >
            Start Free Trial
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-8 py-3 text-base font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
          >
            Log In
          </Link>
        </div>

        <p className="text-slate-500 text-sm">
          No credit card required · Free for solo operators
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2 justify-center mt-12 max-w-md">
        {[
          "Customer management",
          "Job scheduling",
          "Photo uploads",
          "Invoice & PDF",
          "Stripe payments",
          "SMS reminders",
          "Austin, TX tax rate",
        ].map((f) => (
          <span
            key={f}
            className="px-3 py-1 bg-slate-700/60 text-slate-300 text-xs rounded-full border border-slate-600/50"
          >
            {f}
          </span>
        ))}
      </div>
    </main>
  );
}
