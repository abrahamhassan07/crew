import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceLimit, planName } from "@/lib/billing";
import type { Organization } from "@/lib/supabase/types";

/** Start of the current calendar month (UTC), as an ISO string. Monthly plan limits reset on the 1st. */
export function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** How many invoices this business has sent to clients this month (counted from each invoice's first send). */
export async function invoicesSentThisMonth(orgId: string): Promise<number> {
  const { count } = await createAdminClient().from("invoices").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("first_sent_at", monthStartISO());
  return count ?? 0;
}

/** An error message if sending one more (new) invoice would go over the plan's monthly cap, otherwise null. */
export async function invoiceCapError(orgId: string): Promise<string | null> {
  const { data: org } = await createAdminClient().from("organizations").select("*").eq("id", orgId).single();
  const limit = invoiceLimit(org as Organization | null);
  if (limit === null) return null;
  const used = await invoicesSentThisMonth(orgId);
  if (used < limit) return null;
  return `You've sent ${used} of ${limit} invoices this month, which is the limit on ${planName(org as Organization)}. Upgrade under Subscription to send more. The count starts again on the 1st.`;
}
