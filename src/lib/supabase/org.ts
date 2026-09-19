import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * The signed-in owner's organization. RLS on organization_members only
 * ever returns rows for auth.uid(), so this can't be pointed at another
 * organization by a client-supplied value.
 */
export async function getCurrentOrganization(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; name: string; timezone: string; currency: string }> {
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .single();

  if (membershipError || !membership) {
    throw new Error(
      "No organization membership found for the signed-in user. The owner account must be provisioned with an organization row first.",
    );
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, timezone, currency")
    .eq("id", membership.organization_id)
    .single();

  if (orgError || !org) {
    throw new Error("Organization not found for the signed-in user.");
  }

  return org;
}
