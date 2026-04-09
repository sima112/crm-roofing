/**
 * lib/quickbooks-sync.ts
 * Two-way sync engine between CrewBooks and QuickBooks Online.
 * All functions are server-only.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { makeApiCall, getValidAccessToken } from "@/lib/quickbooks";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Logging helper
// ─────────────────────────────────────────────────────────────────────────────

async function log(opts: {
  businessId: string;
  entityType: "customer" | "invoice" | "payment";
  entityId: string | null;
  direction: "push" | "pull";
  status: "success" | "error";
  errorMessage?: string;
  qboId?: string;
}) {
  const admin = createAdminClient();
  await admin.from("sync_log").insert({
    business_id:   opts.businessId,
    entity_type:   opts.entityType,
    entity_id:     opts.entityId,
    direction:     opts.direction,
    status:        opts.status,
    error_message: opts.errorMessage ?? null,
    qbo_id:        opts.qboId ?? null,
  } as never);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit safe delay between batch calls
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiCallWithRetry(
  businessId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
  retries = 1
): Promise<unknown> {
  try {
    return await makeApiCall(businessId, endpoint, method, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") && retries > 0) {
      await delay(60_000);
      return apiCallWithRetry(businessId, endpoint, method, body, retries - 1);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// a. syncCustomerToQBO
// ─────────────────────────────────────────────────────────────────────────────

export async function syncCustomerToQBO(
  businessId: string,
  customerId: string
): Promise<{ error: string | null; qboId?: string }> {
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("id, name, phone, email, address, city, state, zip, qbo_customer_id")
    .eq("id", customerId)
    .single();

  if (!customer) return { error: "Customer not found" };

  const c = customer as {
    id: string; name: string; phone: string | null; email: string | null;
    address: string | null; city: string | null; state: string | null;
    zip: string | null; qbo_customer_id: string | null;
  };

  // Split name into given/family (last word = family)
  const nameParts   = c.name.trim().split(/\s+/);
  const familyName  = nameParts.length > 1 ? nameParts.pop()! : "";
  const givenName   = nameParts.join(" ") || c.name;

  const qboPayload: Record<string, unknown> = {
    DisplayName: c.name,
    GivenName:   givenName,
    FamilyName:  familyName,
    ...(c.phone  ? { PrimaryPhone: { FreeFormNumber: c.phone } } : {}),
    ...(c.email  ? { PrimaryEmailAddr: { Address: c.email } } : {}),
    ...(c.address ? {
      BillAddr: {
        Line1:                    c.address,
        City:                     c.city  ?? "",
        CountrySubDivisionCode:   c.state ?? "",
        PostalCode:               c.zip   ?? "",
        Country:                  "US",
      },
    } : {}),
  };

  try {
    let qboId: string;

    if (c.qbo_customer_id) {
      // Fetch SyncToken (required for updates)
      const existing = await apiCallWithRetry(businessId, `customer/${c.qbo_customer_id}`) as {
        Customer: { SyncToken: string };
      };
      const payload = {
        ...qboPayload,
        Id:        c.qbo_customer_id,
        SyncToken: existing.Customer.SyncToken,
        sparse:    true,
      };
      const res = await apiCallWithRetry(businessId, "customer", "POST", { Customer: payload }) as {
        Customer: { Id: string };
      };
      qboId = res.Customer.Id;
    } else {
      const res = await apiCallWithRetry(businessId, "customer", "POST", { Customer: qboPayload }) as {
        Customer: { Id: string };
      };
      qboId = res.Customer.Id;
    }

    await admin
      .from("customers")
      .update({ qbo_customer_id: qboId, qbo_synced_at: new Date().toISOString() } as never)
      .eq("id", customerId);

    await log({ businessId, entityType: "customer", entityId: customerId, direction: "push", status: "success", qboId });
    return { error: null, qboId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log({ businessId, entityType: "customer", entityId: customerId, direction: "push", status: "error", errorMessage: message });
    return { error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// b. syncInvoiceToQBO
// ─────────────────────────────────────────────────────────────────────────────

export async function syncInvoiceToQBO(
  businessId: string,
  invoiceId: string
): Promise<{ error: string | null; qboId?: string }> {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select(`
      id, invoice_number, amount, tax_rate, total, due_date, notes,
      line_items, qbo_invoice_id,
      customers(id, name, qbo_customer_id)
    `)
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { error: "Invoice not found" };

  type InvoiceData = {
    id: string; invoice_number: string; amount: number; tax_rate: number;
    total: number; due_date: string | null; notes: string | null;
    line_items: LineItem[]; qbo_invoice_id: string | null;
    customers: { id: string; name: string; qbo_customer_id: string | null } | null;
  };
  const inv = invoice as unknown as InvoiceData;

  // Mark as pending
  await admin
    .from("invoices")
    .update({ qbo_sync_status: "pending" } as never)
    .eq("id", invoiceId);

  try {
    // Ensure customer is in QBO first
    let qboCustomerId = inv.customers?.qbo_customer_id ?? null;
    if (!qboCustomerId && inv.customers?.id) {
      const result = await syncCustomerToQBO(businessId, inv.customers.id);
      if (result.error) throw new Error(`Customer sync failed: ${result.error}`);
      qboCustomerId = result.qboId ?? null;
    }
    if (!qboCustomerId) throw new Error("Could not resolve QBO customer ID");

    // Build line items
    const lineItems = (Array.isArray(inv.line_items) ? inv.line_items : []) as LineItem[];
    const qboLines: unknown[] = lineItems.length > 0
      ? lineItems.map((li, i) => ({
          Id:          String(i + 1),
          LineNum:     i + 1,
          Description: li.description,
          Amount:      Number(li.amount),
          DetailType:  "SalesItemLineDetail",
          SalesItemLineDetail: {
            Qty:       Number(li.quantity),
            UnitPrice: Number(li.unit_price),
            ItemRef:   { value: "1", name: "Services" }, // default Services item
          },
        }))
      : [{
          Amount:     Number(inv.amount),
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            Qty:       1,
            UnitPrice: Number(inv.amount),
            ItemRef:   { value: "1", name: "Services" },
          },
        }];

    const qboPayload: Record<string, unknown> = {
      DocNumber:    inv.invoice_number,
      CustomerRef:  { value: qboCustomerId },
      Line:         qboLines,
      ...(inv.due_date   ? { DueDate: inv.due_date } : {}),
      ...(inv.notes      ? { CustomerMemo: { value: inv.notes } } : {}),
    };

    let qboId: string;

    if (inv.qbo_invoice_id) {
      const existing = await apiCallWithRetry(businessId, `invoice/${inv.qbo_invoice_id}`) as {
        Invoice: { SyncToken: string };
      };
      const payload = {
        ...qboPayload,
        Id:        inv.qbo_invoice_id,
        SyncToken: existing.Invoice.SyncToken,
        sparse:    true,
      };
      const res = await apiCallWithRetry(businessId, "invoice", "POST", { Invoice: payload }) as {
        Invoice: { Id: string };
      };
      qboId = res.Invoice.Id;
    } else {
      const res = await apiCallWithRetry(businessId, "invoice", "POST", { Invoice: qboPayload }) as {
        Invoice: { Id: string };
      };
      qboId = res.Invoice.Id;
    }

    await admin
      .from("invoices")
      .update({
        qbo_invoice_id:  qboId,
        qbo_synced_at:   new Date().toISOString(),
        qbo_sync_status: "synced",
        qbo_sync_error:  null,
      } as never)
      .eq("id", invoiceId);

    await log({ businessId, entityType: "invoice", entityId: invoiceId, direction: "push", status: "success", qboId });
    return { error: null, qboId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("invoices")
      .update({ qbo_sync_status: "error", qbo_sync_error: message } as never)
      .eq("id", invoiceId);
    await log({ businessId, entityType: "invoice", entityId: invoiceId, direction: "push", status: "error", errorMessage: message });
    return { error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// c. syncPaymentFromQBO
// ─────────────────────────────────────────────────────────────────────────────

export async function syncPaymentFromQBO(
  businessId: string,
  qboPaymentData: {
    TotalAmt: number;
    Line: { LinkedTxn: { TxnId: string; TxnType: string }[] }[];
  }
): Promise<{ error: string | null }> {
  const admin = createAdminClient();

  // Find referenced invoice IDs in the payment
  const invoiceRefs = (qboPaymentData.Line ?? [])
    .flatMap((l) => l.LinkedTxn ?? [])
    .filter((t) => t.TxnType === "Invoice")
    .map((t) => t.TxnId);

  if (invoiceRefs.length === 0) return { error: null };

  for (const qboInvoiceId of invoiceRefs) {
    const { data: invoice } = await admin
      .from("invoices")
      .select("id, total, status")
      .eq("qbo_invoice_id", qboInvoiceId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!invoice) continue;
    const inv = invoice as { id: string; total: number; status: string };

    if (inv.status === "paid") continue;

    const paidInFull = qboPaymentData.TotalAmt >= Number(inv.total) * 0.99; // 1% tolerance
    if (paidInFull) {
      await admin
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString() } as never)
        .eq("id", inv.id);

      await log({
        businessId,
        entityType: "payment",
        entityId:   inv.id,
        direction:  "pull",
        status:     "success",
        qboId:      qboInvoiceId,
      });
    }
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// d. pullCustomersFromQBO
// ─────────────────────────────────────────────────────────────────────────────

export async function pullCustomersFromQBO(
  businessId: string
): Promise<{ created: number; updated: number; error: string | null }> {
  const tokens = await getValidAccessToken(businessId);
  if (!tokens) return { created: 0, updated: 0, error: "QuickBooks not connected" };

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .single();
  if (!business) return { created: 0, updated: 0, error: "Business not found" };

  let created  = 0;
  let updated  = 0;
  let startPos = 1;
  const PAGE   = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${startPos} MAXRESULTS ${PAGE}`;
    const res = await apiCallWithRetry(
      businessId,
      `query?query=${encodeURIComponent(query)}`
    ) as { QueryResponse: { Customer?: QBOCustomer[]; totalCount?: number } };

    const customers = res.QueryResponse.Customer ?? [];
    if (customers.length === 0) break;

    for (const qboCust of customers) {
      // Look for existing customer by qbo_customer_id
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("qbo_customer_id", qboCust.Id)
        .eq("business_id", businessId)
        .maybeSingle();

      const mapped = {
        name:    qboCust.DisplayName ?? qboCust.FullyQualifiedName ?? "Unknown",
        phone:   qboCust.PrimaryPhone?.FreeFormNumber ?? null,
        email:   qboCust.PrimaryEmailAddr?.Address ?? null,
        address: qboCust.BillAddr?.Line1 ?? null,
        city:    qboCust.BillAddr?.City ?? null,
        state:   qboCust.BillAddr?.CountrySubDivisionCode ?? null,
        zip:     qboCust.BillAddr?.PostalCode ?? null,
        qbo_customer_id: qboCust.Id,
        qbo_synced_at:   new Date().toISOString(),
      };

      if (existing) {
        const ex = existing as { id: string };
        await admin.from("customers").update(mapped as never).eq("id", ex.id);
        updated++;
        await log({ businessId, entityType: "customer", entityId: ex.id, direction: "pull", status: "success", qboId: qboCust.Id });
      } else {
        const { data: created_ } = await admin
          .from("customers")
          .insert({ ...mapped, business_id: businessId } as never)
          .select("id")
          .single();
        const newId = (created_ as { id: string } | null)?.id ?? null;
        created++;
        await log({ businessId, entityType: "customer", entityId: newId, direction: "pull", status: "success", qboId: qboCust.Id });
      }

      await delay(120); // ~500 req/min max
    }

    if (customers.length < PAGE) break;
    startPos += PAGE;
  }

  return { created, updated, error: null };
}

interface QBOCustomer {
  Id: string;
  DisplayName?: string;
  FullyQualifiedName?: string;
  PrimaryPhone?: { FreeFormNumber?: string };
  PrimaryEmailAddr?: { Address?: string };
  BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// e. fullSync
// ─────────────────────────────────────────────────────────────────────────────

export async function fullSync(businessId: string): Promise<{
  customers_pushed: number;
  invoices_pushed:  number;
  customers_pulled: number;
  errors:           string[];
}> {
  const admin   = createAdminClient();
  const errors: string[] = [];
  let customersPushed = 0;
  let invoicesPushed  = 0;

  // Push unsynced customers
  const { data: unsyncedCustomers } = await admin
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .is("qbo_customer_id", null);

  for (const c of unsyncedCustomers ?? []) {
    const { error } = await syncCustomerToQBO(businessId, (c as { id: string }).id);
    if (error) errors.push(`Customer: ${error}`);
    else customersPushed++;
    await delay(120);
  }

  // Push unsynced/errored invoices
  const { data: unsyncedInvoices } = await admin
    .from("invoices")
    .select("id")
    .eq("business_id", businessId)
    .in("qbo_sync_status", ["not_synced", "error"]);

  for (const inv of unsyncedInvoices ?? []) {
    const { error } = await syncInvoiceToQBO(businessId, (inv as { id: string }).id);
    if (error) errors.push(`Invoice: ${error}`);
    else invoicesPushed++;
    await delay(120);
  }

  // Pull customers from QBO
  const pullResult = await pullCustomersFromQBO(businessId);
  if (pullResult.error) errors.push(`Pull: ${pullResult.error}`);

  // Update last sync time
  await admin
    .from("businesses")
    .update({ qbo_last_sync_at: new Date().toISOString() } as never)
    .eq("id", businessId);

  return {
    customers_pushed: customersPushed,
    invoices_pushed:  invoicesPushed,
    customers_pulled: pullResult.created + pullResult.updated,
    errors,
  };
}
