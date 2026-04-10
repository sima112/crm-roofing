// lib/crewbot/context.ts
// Pure helpers — no "use client", usable from both server and client.

export type PageContext = {
  page:
    | "dashboard"
    | "customers"
    | "customer_detail"
    | "jobs"
    | "job_detail"
    | "invoices"
    | "invoice_detail"
    | "settings"
    | "other";
  entityId?: string;
};

export function getPageContextFromPath(pathname: string): PageContext {
  if (pathname === "/dashboard") return { page: "dashboard" };
  if (pathname === "/customers") return { page: "customers" };
  if (pathname === "/jobs")      return { page: "jobs" };
  if (pathname === "/invoices")  return { page: "invoices" };
  if (pathname === "/settings")  return { page: "settings" };

  const customerMatch = pathname.match(/^\/customers\/([^/]+)/);
  if (customerMatch) return { page: "customer_detail", entityId: customerMatch[1] };

  const jobMatch = pathname.match(/^\/jobs\/([^/]+)/);
  if (jobMatch) return { page: "job_detail", entityId: jobMatch[1] };

  const invoiceMatch = pathname.match(/^\/invoices\/([^/]+)/);
  if (invoiceMatch) return { page: "invoice_detail", entityId: invoiceMatch[1] };

  return { page: "other" };
}

export function buildContextSystemMessage(ctx: PageContext): string {
  switch (ctx.page) {
    case "dashboard":
      return "CONTEXT: The user is on their business dashboard with KPIs and today's schedule.";
    case "customers":
      return "CONTEXT: The user is browsing their customer list.";
    case "customer_detail":
      return `CONTEXT: The user is on a customer detail page.${ctx.entityId ? ` Customer ID: ${ctx.entityId} — you can look up their jobs and invoices without them specifying.` : ""}`;
    case "jobs":
      return "CONTEXT: The user is browsing their jobs list.";
    case "job_detail":
      return `CONTEXT: The user is on a job detail page.${ctx.entityId ? ` Job ID: ${ctx.entityId} — you can update status, reschedule, or create an invoice without them specifying the job.` : ""}`;
    case "invoices":
      return "CONTEXT: The user is browsing their invoices list.";
    case "invoice_detail":
      return `CONTEXT: The user is on an invoice detail page.${ctx.entityId ? ` Invoice ID: ${ctx.entityId} — you can send it, mark it paid, or check status without them specifying the invoice.` : ""}`;
    case "settings":
      return "CONTEXT: The user is in Settings.";
    default:
      return "";
  }
}

export function getContextGreeting(ctx: PageContext): string {
  switch (ctx.page) {
    case "dashboard":
      return "Here's your business overview. Ask me about your schedule, revenue, or anything else.";
    case "customers":
      return "You're on the customer list. I can find customers, add new ones, or check payment history.";
    case "customer_detail":
      return "You're viewing a customer. Ask me anything about them — jobs, invoices, payment history.";
    case "jobs":
      return "You're on the jobs board. I can find, schedule, or update any job.";
    case "job_detail":
      return "You're on a job page. I can update its status, reschedule, or create an invoice.";
    case "invoices":
      return "You're on the invoices list. I can find invoices, check status, or help you collect.";
    case "invoice_detail":
      return "You're viewing an invoice. I can send it, mark it paid, or check payment status.";
    default:
      return "Ask me anything about your customers, jobs, or invoices.";
  }
}

export const QUICK_ACTIONS: Record<PageContext["page"], string[]> = {
  dashboard: [
    "What's my schedule today?",
    "How much revenue this month?",
    "Any overdue invoices?",
    "Create a new job",
  ],
  customers: [
    "Find a customer",
    "Add new customer",
    "Who owes the most?",
    "Customers with no jobs recently",
  ],
  customer_detail: [
    "Show their recent jobs",
    "Create a job for this customer",
    "How much have they paid total?",
    "Send them a text",
  ],
  jobs: [
    "What's scheduled today?",
    "Jobs in progress right now",
    "Completed jobs this week",
    "Jobs with no invoice",
  ],
  job_detail: [
    "Mark this job complete",
    "Create invoice for this job",
    "Reschedule this job",
    "Text the customer",
  ],
  invoices: [
    "Show all unpaid invoices",
    "Total outstanding balance",
    "Any invoices overdue?",
    "Create new invoice",
  ],
  invoice_detail: [
    "Send this invoice",
    "Mark as paid",
    "When was this last viewed?",
    "Apply late fee",
  ],
  settings: [
    "What's my current late fee setting?",
    "Help me set up daily briefings",
    "How do I connect QuickBooks?",
    "What integrations are available?",
  ],
  other: [
    "What's my schedule today?",
    "How much revenue this month?",
    "Any overdue invoices?",
    "Create a new job",
  ],
};
