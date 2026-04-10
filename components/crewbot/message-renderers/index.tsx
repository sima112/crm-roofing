import { CustomerCardList } from "./customer-card";
import { JobCardList } from "./job-card";
import { InvoiceCardDisplay } from "./invoice-card";
import { StatsCard } from "./stats-card";
import { ScheduleList } from "./schedule-list";

interface ToolResultRendererProps {
  toolName: string;
  output: unknown;
}

export function ToolResultRenderer({ toolName, output }: ToolResultRendererProps) {
  switch (toolName) {
    case "searchCustomers":
    case "getCustomerDetail":
    case "createCustomer":
      return <CustomerCardList output={output} />;

    case "searchJobs":
    case "createJob":
    case "updateJobStatus":
    case "rescheduleJob":
      return <JobCardList output={output} />;

    case "createInvoice":
    case "sendInvoice":
      return <InvoiceCardDisplay output={output} />;

    case "getBusinessStats":
      return <StatsCard output={output} />;

    case "getUpcomingSchedule":
      return <ScheduleList output={output} />;

    default:
      return null;
  }
}
