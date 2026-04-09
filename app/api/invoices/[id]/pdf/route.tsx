import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 48, color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 36 },
  businessName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e", marginBottom: 4 },
  businessDetail: { fontSize: 9, color: "#6b7280", lineHeight: 1.5 },
  invoiceLabel: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#0f766e", textAlign: "right" },
  invoiceMeta: { fontSize: 9, color: "#6b7280", textAlign: "right", lineHeight: 1.8 },
  invoiceMetaValue: { fontSize: 9, color: "#111827", textAlign: "right", fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  billToName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  billToDetail: { fontSize: 9, color: "#374151", lineHeight: 1.5 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "6 8", marginBottom: 0 },
  tableRow: { flexDirection: "row", padding: "6 8", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { flexDirection: "row", padding: "6 8", backgroundColor: "#f9fafb", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  colDesc: { flex: 1 },
  colQty: { width: 40, textAlign: "center" },
  colPrice: { width: 72, textAlign: "right" },
  colAmount: { width: 80, textAlign: "right" },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase" },
  tdText: { fontSize: 9, color: "#374151" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  totalsLabel: { width: 120, fontSize: 9, color: "#6b7280", textAlign: "right", paddingRight: 12, paddingVertical: 3 },
  totalsValue: { width: 80, fontSize: 9, color: "#111827", textAlign: "right", paddingVertical: 3 },
  totalRowFinal: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4, backgroundColor: "#0f766e", padding: "6 8", borderRadius: 4 },
  totalLabelFinal: { width: 120, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right", paddingRight: 12 },
  totalValueFinal: { width: 80, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" },
  notes: { marginTop: 24, padding: 12, backgroundColor: "#f9fafb", borderRadius: 4 },
  notesLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  notesText: { fontSize: 9, color: "#374151", lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, textAlign: "center", fontSize: 8, color: "#9ca3af" },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaBlock: { flex: 1 },
});

function fmt(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: invoice }, { data: business }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, customers(name, phone, email, address, city, state, zip)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name, phone, email, address")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!invoice || !business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const customer = invoice.customers as {
    name: string; phone: string | null; email: string | null;
    address: string | null; city: string | null; state: string | null; zip: string | null;
  } | null;

  type LI = { description: string; quantity: number; unit_price: number; amount: number };
  const lineItems: LI[] = Array.isArray(invoice.line_items) ? invoice.line_items as LI[] : [];
  const amount = Number(invoice.amount ?? 0);
  const taxRate = Number(invoice.tax_rate ?? 0.0825);
  const taxAmount = amount * taxRate;
  const total = amount + taxAmount;

  const InvoicePDF = () => (
    <Document title={`${invoice.invoice_number} — CrewBooks`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{business.name}</Text>
            {business.address && <Text style={styles.businessDetail}>{business.address}</Text>}
            {business.phone && <Text style={styles.businessDetail}>{business.phone}</Text>}
            {business.email && <Text style={styles.businessDetail}>{business.email}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>
              Invoice #{" "}<Text style={styles.invoiceMetaValue}>{invoice.invoice_number}</Text>
            </Text>
            <Text style={styles.invoiceMeta}>
              Date:{" "}<Text style={styles.invoiceMetaValue}>{fmtDate(invoice.created_at)}</Text>
            </Text>
            <Text style={styles.invoiceMeta}>
              Due:{" "}<Text style={styles.invoiceMetaValue}>{fmtDate(invoice.due_date)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.billToName}>{customer?.name ?? "—"}</Text>
          {customer?.address && <Text style={styles.billToDetail}>{customer.address}</Text>}
          {(customer?.city || customer?.state) && (
            <Text style={styles.billToDetail}>
              {[customer?.city, customer?.state, customer?.zip].filter(Boolean).join(", ")}
            </Text>
          )}
          {customer?.phone && <Text style={styles.billToDetail}>{customer.phone}</Text>}
          {customer?.email && <Text style={styles.billToDetail}>{customer.email}</Text>}
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colDesc]}>Description</Text>
            <Text style={[styles.thText, styles.colQty]}>Qty</Text>
            <Text style={[styles.thText, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.thText, styles.colAmount]}>Amount</Text>
          </View>
          {lineItems.map((li, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tdText, styles.colDesc]}>{li.description}</Text>
              <Text style={[styles.tdText, styles.colQty]}>{li.quantity}</Text>
              <Text style={[styles.tdText, styles.colPrice]}>{fmt(li.unit_price)}</Text>
              <Text style={[styles.tdText, styles.colAmount]}>{fmt(li.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmt(amount)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax ({(taxRate * 100).toFixed(2)}%)</Text>
            <Text style={styles.totalsValue}>{fmt(taxAmount)}</Text>
          </View>
          <View style={styles.totalRowFinal}>
            <Text style={styles.totalLabelFinal}>Total Due</Text>
            <Text style={styles.totalValueFinal}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {business.name} · Generated by CrewBooks
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(<InvoicePDF />);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
