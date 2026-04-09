"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { qboConfigured } from "@/lib/quickbooks";
import { syncCustomerToQBO } from "@/lib/quickbooks-sync";

// ── Add customer ─────────────────────────────────────────────────────────────

export type CustomerFormState = { error: string | null; success: boolean };

export async function addCustomerAction(
  _prev: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { error: "Business not found", success: false };
  const biz = business as { id: string };

  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Name is required", success: false };

  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw ? tagsRaw.split(",").filter(Boolean) : null;

  const { error } = await supabase.from("customers").insert({
    business_id: biz.id,
    name: name.trim(),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || "TX",
    zip: (formData.get("zip") as string) || null,
    notes: (formData.get("notes") as string) || null,
    tags,
    source: (formData.get("source") as string) || null,
  } as never);

  if (error) return { error: error.message, success: false };

  // Auto-sync to QBO if connected
  if (qboConfigured) {
    const { data: bizData } = await supabase
      .from("businesses")
      .select("id, qbo_sync_enabled")
      .eq("owner_id", user.id)
      .maybeSingle();
    const b = bizData as { id: string; qbo_sync_enabled: boolean } | null;
    if (b?.qbo_sync_enabled) {
      // Get the inserted customer id
      const admin = createAdminClient();
      const { data: newCust } = await admin
        .from("customers")
        .select("id")
        .eq("business_id", b.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (newCust) {
        syncCustomerToQBO(b.id, (newCust as { id: string }).id).catch(() => {});
      }
    }
  }

  revalidatePath("/customers");
  return { error: null, success: true };
}

// ── Update customer ───────────────────────────────────────────────────────────

export async function updateCustomerAction(
  id: string,
  formData: FormData
): Promise<CustomerFormState> {
  const supabase = await createClient();

  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw ? tagsRaw.split(",").filter(Boolean) : null;

  const { error } = await supabase
    .from("customers")
    .update({
      name: (formData.get("name") as string).trim(),
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || "TX",
      zip: (formData.get("zip") as string) || null,
      notes: (formData.get("notes") as string) || null,
      tags,
      source: (formData.get("source") as string) || null,
    } as never)
    .eq("id", id);

  if (error) return { error: error.message, success: false };

  // Auto-sync updated customer to QBO if connected
  if (qboConfigured) {
    const admin = createAdminClient();
    const { data: cust } = await admin
      .from("customers")
      .select("business_id, businesses(id, qbo_sync_enabled)")
      .eq("id", id)
      .maybeSingle();
    const custData = cust as { business_id: string; businesses: { id: string; qbo_sync_enabled: boolean } | null } | null;
    if (custData?.businesses?.qbo_sync_enabled) {
      syncCustomerToQBO(custData.business_id, id).catch(() => {});
    }
  }

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return { error: null, success: true };
}

// ── Update notes (auto-save) ──────────────────────────────────────────────────

export async function updateCustomerNotesAction(
  id: string,
  notes: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ notes } as never)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${id}`);
  return { error: null };
}

// ── Delete customer ───────────────────────────────────────────────────────────

export async function deleteCustomerAction(
  id: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const { error } = await admin.from("customers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { error: null };
}
