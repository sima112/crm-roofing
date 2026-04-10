/**
 * lib/invoice-email.ts
 * Builds the HTML email body for invoice delivery.
 */

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export type InvoiceEmailData = {
  invoiceId:          string;
  invoiceNumber:      string;
  customerName:       string;
  businessName:       string;
  businessPhone:      string | null;
  businessEmail:      string | null;
  businessAddress:    string | null;
  total:              number;
  amount:             number;
  taxAmount:          number;
  taxRate:            number;
  dueDate:            string | null;
  createdAt:          string;
  paymentLink:        string | null;
  pdfLink:            string;
  trackingUrl:        string;
  lineItems: { description: string; quantity: number; unit_price: number; amount: number }[];
};

export function buildInvoiceEmail(data: InvoiceEmailData): { subject: string; html: string } {
  const subject = `Invoice ${data.invoiceNumber} from ${data.businessName} — ${fmt(data.total)} due ${fmtDate(data.dueDate)}`;

  const lineItemsRows = data.lineItems.map((li) => `
    <tr>
      <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f0f0f0;color:#374151;">${li.description}</td>
      <td style="padding:10px 16px;font-size:14px;text-align:center;border-bottom:1px solid #f0f0f0;color:#6b7280;">${li.quantity}</td>
      <td style="padding:10px 16px;font-size:14px;text-align:right;border-bottom:1px solid #f0f0f0;color:#374151;font-family:monospace;">${fmt(li.unit_price)}</td>
      <td style="padding:10px 16px;font-size:14px;text-align:right;border-bottom:1px solid #f0f0f0;color:#374151;font-weight:600;font-family:monospace;">${fmt(li.amount)}</td>
    </tr>
  `).join("");

  const payButton = data.paymentLink ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
      <tr>
        <td align="center">
          <a href="${data.paymentLink}"
             style="display:inline-block;background:#0f766e;color:#ffffff;font-size:16px;font-weight:700;
                    padding:14px 40px;border-radius:10px;text-decoration:none;letter-spacing:-0.01em;">
            Pay Online — ${fmt(data.total)}
          </a>
        </td>
      </tr>
    </table>
  ` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Tracking pixel (1×1) -->
  <img src="${data.trackingUrl}" width="1" height="1" alt="" style="display:none;" />

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header bar -->
          <tr>
            <td style="background:#0f766e;padding:24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${data.businessName}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#99f6e4;letter-spacing:0.05em;text-transform:uppercase;">Invoice</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <p style="margin:0 0 24px;font-size:15px;color:#374151;">
                Hi ${data.customerName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Please find your invoice from ${data.businessName} below.
                ${data.dueDate ? `Payment is due by <strong>${fmtDate(data.dueDate)}</strong>.` : ""}
              </p>

              <!-- Invoice meta -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
                <tr>
                  <td style="font-size:13px;color:#6b7280;">Invoice #</td>
                  <td style="font-size:13px;font-weight:700;color:#111827;text-align:right;font-family:monospace;">${data.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;padding-top:6px;">Date</td>
                  <td style="font-size:13px;color:#374151;text-align:right;padding-top:6px;">${fmtDate(data.createdAt)}</td>
                </tr>
                ${data.dueDate ? `<tr>
                  <td style="font-size:13px;color:#6b7280;padding-top:6px;">Due Date</td>
                  <td style="font-size:13px;color:#374151;text-align:right;padding-top:6px;">${fmtDate(data.dueDate)}</td>
                </tr>` : ""}
                <tr>
                  <td style="font-size:15px;font-weight:700;color:#111827;padding-top:10px;border-top:1px solid #e5e7eb;margin-top:6px;">Amount Due</td>
                  <td style="font-size:18px;font-weight:800;color:#0f766e;text-align:right;padding-top:10px;border-top:1px solid #e5e7eb;font-family:monospace;">${fmt(data.total)}</td>
                </tr>
              </table>

              <!-- Line items -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:10px 16px;font-size:11px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Description</th>
                    <th style="padding:10px 16px;font-size:11px;text-align:center;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:48px;">Qty</th>
                    <th style="padding:10px 16px;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:100px;">Unit</th>
                    <th style="padding:10px 16px;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:100px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsRows}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding:8px 16px;font-size:13px;text-align:right;color:#6b7280;">Subtotal</td>
                    <td style="padding:8px 16px;font-size:13px;text-align:right;font-family:monospace;color:#374151;">${fmt(data.amount)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:8px 16px;font-size:13px;text-align:right;color:#6b7280;">Tax (${(data.taxRate * 100).toFixed(2)}%)</td>
                    <td style="padding:8px 16px;font-size:13px;text-align:right;font-family:monospace;color:#374151;">${fmt(data.taxAmount)}</td>
                  </tr>
                  <tr style="background:#f8fafc;">
                    <td colspan="3" style="padding:12px 16px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #e5e7eb;">Total Due</td>
                    <td style="padding:12px 16px;font-size:16px;font-weight:800;text-align:right;font-family:monospace;color:#0f766e;border-top:2px solid #e5e7eb;">${fmt(data.total)}</td>
                  </tr>
                </tfoot>
              </table>

              <!-- Pay button -->
              ${payButton}

              <!-- PDF link -->
              <p style="text-align:center;margin:0 0 32px;">
                <a href="${data.pdfLink}" style="font-size:13px;color:#6b7280;text-decoration:underline;">
                  Download PDF invoice
                </a>
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;" />

              <!-- Business footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;font-weight:700;color:#374151;">${data.businessName}</p>
                    ${data.businessAddress ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${data.businessAddress}</p>` : ""}
                    ${data.businessPhone ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${data.businessPhone}</p>` : ""}
                    ${data.businessEmail ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${data.businessEmail}</p>` : ""}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
                Sent via <strong>CrewBooks</strong> — invoicing for contractors
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
