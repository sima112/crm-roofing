import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { InlineJobForm } from "./inline-job-form";

export const metadata: Metadata = { title: "New Job" };

interface Props {
  searchParams: Promise<{ customer_id?: string; date?: string }>;
}

export default async function NewJobPage({ searchParams }: Props) {
  const { customer_id, date } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/jobs">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Jobs
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Job</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <InlineJobForm defaultCustomerId={customer_id} defaultDate={date} />
      </div>
    </div>
  );
}
