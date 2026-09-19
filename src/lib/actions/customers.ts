"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/org";
import { parsePriceToCents } from "@/lib/domain/money";
import type { CustomerInsert } from "@/lib/supabase/types";

export interface ActionResult {
  error: string | null;
}

function readCustomerFields(formData: FormData): {
  fields: Omit<CustomerInsert, "organization_id">;
  error: string | null;
} {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const addressLine1 = String(formData.get("address_line1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();
  const priceInput = String(formData.get("default_price") ?? "").trim();

  if (!firstName || !lastName || !phone || !addressLine1 || !city || !state || !postalCode) {
    return {
      fields: {} as Omit<CustomerInsert, "organization_id">,
      error: "Name, phone, and full address are required.",
    };
  }

  let defaultPriceCents: number;
  try {
    defaultPriceCents = parsePriceToCents(priceInput);
  } catch {
    return {
      fields: {} as Omit<CustomerInsert, "organization_id">,
      error: "Enter a valid default price, like 50 or 50.00.",
    };
  }

  return {
    fields: {
      first_name: firstName,
      last_name: lastName,
      phone,
      email: email || null,
      address_line1: addressLine1,
      city,
      state,
      postal_code: postalCode,
      default_price_cents: defaultPriceCents,
      general_notes: String(formData.get("general_notes") ?? "").trim() || null,
      property_notes: String(formData.get("property_notes") ?? "").trim() || null,
      gate_code: String(formData.get("gate_code") ?? "").trim() || null,
      access_notes: String(formData.get("access_notes") ?? "").trim() || null,
    },
    error: null,
  };
}

export async function createCustomer(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { fields, error } = readCustomerFields(formData);
  if (error) return { error };

  const supabase = await createClient();
  const org = await getCurrentOrganization(supabase);

  const { data, error: insertError } = await supabase
    .from("customers")
    .insert({ ...fields, organization_id: org.id })
    .select("id")
    .single();

  if (insertError || !data) {
    return { error: "Could not save the customer. Please try again." };
  }

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(
  customerId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { fields, error } = readCustomerFields(formData);
  if (error) return { error };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("customers")
    .update(fields)
    .eq("id", customerId);

  if (updateError) {
    return { error: "Could not save the changes. Please try again." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

export async function deactivateCustomer(customerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_customer", {
    p_customer_id: customerId,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  if (error) {
    if (error.message.includes("resolve the active job")) {
      return { error: "Finish or reschedule this customer's active job before deactivating." };
    }
    return { error: "Could not deactivate this customer." };
  }
  return { error: null };
}

export async function reactivateCustomer(customerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_customer", {
    p_customer_id: customerId,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  if (error) return { error: "Could not reactivate this customer." };
  return { error: null };
}
