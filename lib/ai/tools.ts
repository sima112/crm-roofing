/**
 * lib/ai/tools.ts
 * CrewBot tool definitions — all database reads/writes for the AI assistant.
 * Server-only. Uses service-role admin client for RLS bypass (business_id is always
 * scoped to the authenticated user's business, passed from the API route).
 */

import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Tax rate constant (matches the invoice form)
const TAX_RATE = 0.0825;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

async function nextInvoiceNumber(businessId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invoices")
    .select("invoice_number")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.invoice_number) return "INV-0001";
  const match = data.invoice_number.match(/(\d+)$/);
  const next = match ? parseInt(match[1]) + 1 : 1;
  return `INV-${String(next).padStart(4, "0")}`;
}

// ── Tool factory — closes over businessId ────────────────────────────────────

export function createCrewBotTools(businessId: string) {
  const admin = createAdminClient();

  // ── searchCustomers ────────────────────────────────────────────────────────
  const searchCustomers = tool({
    description: "Search customers by name, phone, email, or address. Use this before creating a new customer to check if they exist.",
    inputSchema: z.object({
      query: z.string().describe("Search term — name, phone number, email, or part of address"),
    }),
    execute: async ({ query }) => {
      const { data } = await admin
        .from("customers")
        .select(`
          id, name, phone, email, address, city, state, zip, notes,
          jobs(id),
          invoices(total, status)
        `)
        .eq("business_id", businessId)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,address.ilike.%${query}%`)
        .limit(8);

      if (!data || data.length === 0) {
        return { found: false, message: `No customers found matching "${query}".` };
      }

      return {
        found: true,
        customers: data.map((c) => {
          const invoices = (c.invoices ?? []) as { total: unknown; status: string }[];
          const revenue = invoices
            .filter((i) => i.status === "paid")
            .reduce((s, i) => s + Number(i.total ?? 0), 0);
          return {
            id:            c.id,
            name:          c.name,
            phone:         c.phone,
            email:         c.email,
            address:       [c.address, c.city, c.state, c.zip].filter(Boolean).join(", "),
            job_count:     (c.jobs ?? []).length,
            total_revenue: fmt(revenue),
          };
        }),
      };
    },
  });

  // ── getCustomerDetail ──────────────────────────────────────────────────────
  const getCustomerDetail = tool({
    description: "Get full details for a specific customer including their recent jobs and invoices.",
    inputSchema: z.object({
      customerId: z.string().describe("UUID of the customer"),
    }),
    execute: async ({ customerId }) => {
      const { data: customer } = await admin
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!customer) return { found: false, message: "Customer not found." };

      const [{ data: jobs }, { data: invoices }] = await Promise.all([
        admin
          .from("jobs")
          .select("id, title, status, scheduled_date, scheduled_time, total_amount, completed_date")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(5),
        admin
          .from("invoices")
          .select("id, invoice_number, status, total, due_date, paid_date")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      return {
        found: true,
        customer: {
          id:      customer.id,
          name:    customer.name,
          phone:   customer.phone,
          email:   customer.email,
          address: [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(", "),
          notes:   customer.notes,
        },
        recent_jobs: (jobs ?? []).map((j) => ({
          id:             j.id,
          title:          j.title,
          status:         j.status,
          scheduled_date: j.scheduled_date,
          scheduled_time: j.scheduled_time,
        })),
        recent_invoices: (invoices ?? []).map((i) => ({
          id:             i.id,
          invoice_number: i.invoice_number,
          status:         i.status,
          total:          fmt(Number(i.total ?? 0)),
          due_date:       i.due_date,
          paid_date:      i.paid_date,
        })),
      };
    },
  });

  // ── createCustomer ─────────────────────────────────────────────────────────
  const createCustomer = tool({
    description: "Create a new customer record. Only call this after confirming with the user.",
    inputSchema: z.object({
      name:    z.string().describe("Full name of the customer"),
      phone:   z.string().optional().describe("Phone number"),
      email:   z.string().email().optional().describe("Email address"),
      address: z.string().optional().describe("Street address"),
      city:    z.string().optional().describe("City"),
      state:   z.string().optional().describe("State (2-letter code)"),
      zip:     z.string().optional().describe("ZIP code"),
      notes:   z.string().optional().describe("Any notes about this customer"),
    }),
    execute: async ({ name, phone, email, address, city, state, zip, notes }) => {
      const { data, error } = await admin
        .from("customers")
        .insert({
          business_id: businessId,
          name,
          phone:   phone   || null,
          email:   email   || null,
          address: address || null,
          city:    city    || null,
          state:   state   || null,
          zip:     zip     || null,
          notes:   notes   || null,
        } as never)
        .select("id, name, phone, email")
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, customer: data, message: `Customer "${name}" created successfully.` };
    },
  });

  // ── searchJobs ─────────────────────────────────────────────────────────────
  const searchJobs = tool({
    description: "Search for jobs by keyword, status, or date range.",
    inputSchema: z.object({
      query:     z.string().optional().describe("Search by job title or customer name"),
      status:    z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
      dateRange: z.object({
        start: z.string().describe("Start date YYYY-MM-DD"),
        end:   z.string().describe("End date YYYY-MM-DD"),
      }).optional().describe("Filter by scheduled date range"),
    }),
    execute: async ({ query, status, dateRange }) => {
      let q = admin
        .from("jobs")
        .select("id, title, status, scheduled_date, scheduled_time, estimated_amount, customers(name)")
        .eq("business_id", businessId)
        .order("scheduled_date", { ascending: false })
        .limit(10);

      if (status) q = q.eq("status", status);
      if (dateRange) {
        q = q.gte("scheduled_date", dateRange.start).lte("scheduled_date", dateRange.end);
      }
      if (query) {
        q = q.or(`title.ilike.%${query}%`);
      }

      const { data } = await q;
      if (!data || data.length === 0) {
        return { found: false, message: "No jobs found matching your criteria." };
      }

      return {
        found: true,
        jobs: data.map((j) => ({
          id:             j.id,
          title:          j.title,
          customer_name:  (j.customers as unknown as { name: string } | null)?.name ?? "—",
          status:         j.status,
          scheduled_date: j.scheduled_date,
          scheduled_time: j.scheduled_time,
          estimated_amount: j.estimated_amount ? fmt(Number(j.estimated_amount)) : null,
        })),
      };
    },
  });

  // ── createJob ──────────────────────────────────────────────────────────────
  const createJob = tool({
    description: "Create a new job for a customer. Only call after confirming with the user.",
    inputSchema: z.object({
      customerId:      z.string().describe("UUID of the customer"),
      title:           z.string().describe("Job title/description (e.g. 'Roof replacement')"),
      description:     z.string().optional().describe("Detailed notes about the work"),
      scheduledDate:   z.string().describe("Date in YYYY-MM-DD format"),
      scheduledTime:   z.string().optional().describe("Time in HH:MM format (24h), e.g. '09:00'"),
      estimatedAmount: z.number().optional().describe("Estimated job value in dollars"),
      priority:        z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
    }),
    execute: async ({ customerId, title, description, scheduledDate, scheduledTime, estimatedAmount, priority }) => {
      const { data, error } = await admin
        .from("jobs")
        .insert({
          business_id:      businessId,
          customer_id:      customerId,
          title,
          description:      description || null,
          scheduled_date:   scheduledDate,
          scheduled_time:   scheduledTime || null,
          estimated_amount: estimatedAmount || null,
          priority:         priority || "medium",
          status:           "scheduled",
        } as never)
        .select("id, title, scheduled_date, scheduled_time, customers(name)")
        .single();

      if (error) return { success: false, error: error.message };

      const customer = (data.customers as unknown as { name: string } | null)?.name ?? "customer";
      return {
        success: true,
        job: {
          id:             data.id,
          title:          data.title,
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time,
          customer_name:  customer,
        },
        message: `Job "${title}" scheduled for ${customer} on ${scheduledDate}.`,
      };
    },
  });

  // ── updateJobStatus ────────────────────────────────────────────────────────
  const updateJobStatus = tool({
    description: "Update the status of a job (scheduled → in_progress → completed, or cancelled). Only call after confirming with the user.",
    inputSchema: z.object({
      jobId:  z.string().describe("UUID of the job"),
      status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
      notes:  z.string().optional().describe("Optional notes about the status change"),
    }),
    execute: async ({ jobId, status, notes }) => {
      // Verify job belongs to this business
      const { data: existing } = await admin
        .from("jobs")
        .select("id, title, status, business_id, customers(name)")
        .eq("id", jobId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!existing) return { success: false, error: "Job not found." };

      const updates: Record<string, unknown> = { status };
      if (status === "completed") updates.completed_date = new Date().toISOString().slice(0, 10);
      if (notes) updates.notes = notes;

      const { error } = await admin
        .from("jobs")
        .update(updates as never)
        .eq("id", jobId);

      if (error) return { success: false, error: error.message };

      const customer = (existing.customers as unknown as { name: string } | null)?.name ?? "";
      return {
        success: true,
        message: `"${existing.title}"${customer ? ` for ${customer}` : ""} is now ${status.replace("_", " ")}.`,
      };
    },
  });

  // ── createInvoice ──────────────────────────────────────────────────────────
  const createInvoice = tool({
    description: "Create an invoice for a customer. Only call after confirming with the user and getting line item details.",
    inputSchema: z.object({
      customerId: z.string().describe("UUID of the customer"),
      jobId:      z.string().optional().describe("UUID of the related job, if any"),
      lineItems:  z.array(z.object({
        description: z.string(),
        quantity:    z.number().positive(),
        unitPrice:   z.number().nonnegative(),
      })).min(1).describe("Invoice line items"),
      dueDate: z.string().optional().describe("Due date YYYY-MM-DD (default: 30 days from now)"),
      notes:   z.string().optional(),
    }),
    execute: async ({ customerId, jobId, lineItems, dueDate, notes }) => {
      // Verify customer belongs to this business
      const { data: customer } = await admin
        .from("customers")
        .select("id, name")
        .eq("id", customerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!customer) return { success: false, error: "Customer not found." };

      const items = lineItems.map((li) => ({
        description: li.description,
        quantity:    li.quantity,
        unit_price:  li.unitPrice,
        amount:      li.quantity * li.unitPrice,
      }));

      const amount = items.reduce((s, li) => s + li.amount, 0);
      const taxAmount = amount * TAX_RATE;
      const total = amount + taxAmount;

      const due = dueDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })();

      const invoiceNumber = await nextInvoiceNumber(businessId);

      const { data, error } = await admin
        .from("invoices")
        .insert({
          business_id:    businessId,
          customer_id:    customerId,
          job_id:         jobId || null,
          invoice_number: invoiceNumber,
          amount,
          tax_rate:       TAX_RATE,
          tax_amount:     taxAmount,
          total,
          line_items:     items,
          due_date:       due,
          notes:          notes || null,
          status:         "draft",
        } as never)
        .select("id, invoice_number, total")
        .single();

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        invoice: {
          id:             data.id,
          invoice_number: data.invoice_number,
          customer_name:  customer.name,
          total:          fmt(total),
          due_date:       due,
          status:         "draft",
        },
        message: `Invoice ${invoiceNumber} created for ${customer.name} — ${fmt(total)} due ${due}. It's a draft — want me to send it?`,
      };
    },
  });

  // ── sendInvoice ────────────────────────────────────────────────────────────
  const sendInvoice = tool({
    description: "Send an invoice to the customer via SMS, email, or both. Only call after confirming.",
    inputSchema: z.object({
      invoiceId: z.string().describe("UUID of the invoice"),
      method:    z.enum(["sms", "email", "both"]),
    }),
    execute: async ({ invoiceId, method }) => {
      const { data: invoice } = await admin
        .from("invoices")
        .select(`
          id, invoice_number, total, status, stripe_payment_link,
          customers(name, phone, email)
        `)
        .eq("id", invoiceId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!invoice) return { success: false, error: "Invoice not found." };

      const customer = invoice.customers as unknown as { name: string; phone: string | null; email: string | null } | null;
      const sent: string[] = [];
      const errors: string[] = [];

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      // Generate Stripe payment link if needed
      if (!invoice.stripe_payment_link) {
        try {
          await fetch(`${appUrl}/api/invoices/${invoiceId}/payment-link`, { method: "POST" });
        } catch {
          // non-fatal
        }
      }

      // SMS
      if ((method === "sms" || method === "both") && customer?.phone) {
        try {
          const { sendSMS } = await import("@/lib/sms");
          const { data: biz } = await admin
            .from("businesses")
            .select("name")
            .eq("id", businessId)
            .single();

          const payLink = invoice.stripe_payment_link ?? `${appUrl}/invoices/${invoiceId}`;
          await sendSMS({
            to: customer.phone,
            body: `Hi ${customer.name}, your invoice from ${(biz as { name: string }).name} for ${fmt(Number(invoice.total))} is ready. Pay here: ${payLink}`,
          });
          sent.push("SMS");
        } catch (e) {
          errors.push(`SMS: ${String(e)}`);
        }
      }

      // Email
      if ((method === "email" || method === "both") && customer?.email) {
        try {
          const { resendConfigured, getResend } = await import("@/lib/resend");
          if (resendConfigured) {
            const { buildInvoiceEmail } = await import("@/lib/invoice-email");
            const { data: biz } = await admin.from("businesses").select("name, phone, email, address").eq("id", businessId).single();
            const b = biz as { name: string; phone: string | null; email: string | null; address: string | null };
            const { data: fullInv } = await admin.from("invoices").select("*, customers(name, email)").eq("id", invoiceId).single();
            const fi = fullInv as {
              invoice_number: string; amount: number; tax_rate: number; tax_amount: number; total: number;
              due_date: string | null; created_at: string; stripe_payment_link: string | null; line_items: unknown;
            };
            type LI = { description: string; quantity: number; unit_price: number; amount: number };
            const { subject, html } = buildInvoiceEmail({
              invoiceId, invoiceNumber: fi.invoice_number, customerName: customer.name,
              businessName: b.name, businessPhone: b.phone, businessEmail: b.email, businessAddress: b.address,
              total: Number(fi.total), amount: Number(fi.amount), taxAmount: Number(fi.tax_amount), taxRate: Number(fi.tax_rate),
              dueDate: fi.due_date, createdAt: fi.created_at, paymentLink: fi.stripe_payment_link,
              pdfLink: `${appUrl}/api/invoices/${invoiceId}/pdf`,
              trackingUrl: `${appUrl}/api/invoices/${invoiceId}/track`,
              lineItems: (Array.isArray(fi.line_items) ? fi.line_items : []) as LI[],
            });
            const resend = getResend();
            await resend.emails.send({
              from: `${b.name} via CrewBooks <${process.env.RESEND_FROM_EMAIL ?? "invoices@crewbooks.app"}>`,
              to: customer.email!,
              subject, html,
            });
            sent.push("email");
          } else {
            errors.push("Email: RESEND_API_KEY not configured");
          }
        } catch (e) {
          errors.push(`Email: ${String(e)}`);
        }
      }

      // Mark invoice as sent
      if (sent.length > 0) {
        const { transitionInvoice } = await import("@/lib/invoice-transition");
        await transitionInvoice(invoiceId, "sent", {
          changedBy: "crewbot",
          sentVia: sent[0] === "SMS" ? "sms" : "email",
          note: `Sent via CrewBot (${sent.join(", ")})`,
        });
      }

      if (sent.length === 0 && errors.length > 0) {
        return { success: false, error: errors.join("; ") };
      }

      return {
        success: true,
        sent_via: sent,
        errors:   errors.length > 0 ? errors : undefined,
        message:  `Invoice ${invoice.invoice_number} sent to ${customer?.name} via ${sent.join(" and ")}.`,
      };
    },
  });

  // ── getBusinessStats ───────────────────────────────────────────────────────
  const getBusinessStats = tool({
    description: "Get business performance stats — revenue, jobs, invoices — for a given time period.",
    inputSchema: z.object({
      period: z.enum(["today", "this_week", "this_month", "this_year"]).optional().default("this_month"),
    }),
    execute: async ({ period }) => {
      const now = new Date();
      let startDate: string;
      switch (period) {
        case "today":
          startDate = now.toISOString().slice(0, 10);
          break;
        case "this_week": {
          const d = new Date(now);
          d.setDate(d.getDate() - d.getDay());
          startDate = d.toISOString().slice(0, 10);
          break;
        }
        case "this_year":
          startDate = `${now.getFullYear()}-01-01`;
          break;
        default: // this_month
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      }

      const [
        { data: paidInvoices },
        { data: unpaidInvoices },
        { data: completedJobs },
        { data: scheduledJobs },
        { data: topCustomers },
      ] = await Promise.all([
        admin.from("invoices").select("total").eq("business_id", businessId).eq("status", "paid").gte("paid_date", startDate),
        admin.from("invoices").select("total").eq("business_id", businessId).in("status", ["sent", "viewed", "partial", "overdue"]),
        admin.from("jobs").select("id").eq("business_id", businessId).eq("status", "completed").gte("completed_date", startDate),
        admin.from("jobs").select("id").eq("business_id", businessId).eq("status", "scheduled"),
        admin.from("invoices").select("total, customers(name)").eq("business_id", businessId).eq("status", "paid").gte("paid_date", startDate).limit(20),
      ]);

      const revenue         = (paidInvoices ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);
      const outstanding     = (unpaidInvoices ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);

      // Aggregate top customers
      const customerMap: Record<string, number> = {};
      for (const inv of topCustomers ?? []) {
        const name = (inv.customers as unknown as { name: string } | null)?.name ?? "Unknown";
        customerMap[name] = (customerMap[name] ?? 0) + Number(inv.total ?? 0);
      }
      const top = Object.entries(customerMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, total]) => `${name}: ${fmt(total)}`);

      return {
        period,
        revenue:            fmt(revenue),
        outstanding_balance: fmt(outstanding),
        jobs_completed:     completedJobs?.length ?? 0,
        jobs_scheduled:     scheduledJobs?.length ?? 0,
        top_customers:      top,
      };
    },
  });

  // ── getUpcomingSchedule ────────────────────────────────────────────────────
  const getUpcomingSchedule = tool({
    description: "Get upcoming scheduled jobs for the next N days.",
    inputSchema: z.object({
      days: z.number().int().min(1).max(30).optional().default(7).describe("Number of days ahead to look"),
    }),
    execute: async ({ days }) => {
      const today  = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

      const { data } = await admin
        .from("jobs")
        .select("id, title, scheduled_date, scheduled_time, priority, customers(name, phone)")
        .eq("business_id", businessId)
        .eq("status", "scheduled")
        .gte("scheduled_date", today)
        .lte("scheduled_date", future)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true, nullsFirst: false });

      if (!data || data.length === 0) {
        return { found: false, message: `No jobs scheduled in the next ${days} days.` };
      }

      return {
        found: true,
        count: data.length,
        jobs:  data.map((j) => {
          const c = j.customers as unknown as { name: string; phone: string | null } | null;
          return {
            id:             j.id,
            title:          j.title,
            customer_name:  c?.name ?? "—",
            customer_phone: c?.phone,
            scheduled_date: j.scheduled_date,
            scheduled_time: j.scheduled_time,
            priority:       j.priority,
          };
        }),
      };
    },
  });

  // ── rescheduleJob ──────────────────────────────────────────────────────────
  const rescheduleJob = tool({
    description: "Reschedule a job to a new date and optionally time. Only call after confirming with the user.",
    inputSchema: z.object({
      jobId:   z.string().describe("UUID of the job to reschedule"),
      newDate: z.string().describe("New date in YYYY-MM-DD format"),
      newTime: z.string().optional().describe("New time in HH:MM 24h format"),
    }),
    execute: async ({ jobId, newDate, newTime }) => {
      const { data: existing } = await admin
        .from("jobs")
        .select("id, title, scheduled_date, scheduled_time, business_id, customers(name)")
        .eq("id", jobId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!existing) return { success: false, error: "Job not found." };

      const updates: Record<string, unknown> = { scheduled_date: newDate };
      if (newTime !== undefined) updates.scheduled_time = newTime;

      const { error } = await admin
        .from("jobs")
        .update(updates as never)
        .eq("id", jobId);

      if (error) return { success: false, error: error.message };

      const customer = (existing.customers as unknown as { name: string } | null)?.name ?? "";
      return {
        success: true,
        old_date: existing.scheduled_date,
        new_date: newDate,
        message:  `"${existing.title}"${customer ? ` for ${customer}` : ""} rescheduled from ${existing.scheduled_date} to ${newDate}${newTime ? ` at ${newTime}` : ""}.`,
      };
    },
  });

  return {
    searchCustomers,
    getCustomerDetail,
    createCustomer,
    searchJobs,
    createJob,
    updateJobStatus,
    createInvoice,
    sendInvoice,
    getBusinessStats,
    getUpcomingSchedule,
    rescheduleJob,
  };
}
