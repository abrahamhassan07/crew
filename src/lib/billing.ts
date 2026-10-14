import type { Organization } from "@/lib/supabase/types";

export type BillingState =
  | { kind: "exempt" }
  | { kind: "active"; plan: string | null; status: string; renews: string | null }
  | { kind: "trial"; daysLeft: number; endsAt: string }
  | { kind: "expired" };

// Billing is only enforced when BILLING_ENFORCED=true, so the app can run as a
// free pilot until you're ready to charge.
export const billingEnforced = () => process.env.BILLING_ENFORCED === "true";

export function getBillingState(org: Pick<Organization, "billing_exempt" | "subscription_status" | "plan" | "current_period_end" | "trial_ends_at"> | null): BillingState {
  // `!== false` also treats a missing column (migration not applied yet) as exempt.
  if (!org || org.billing_exempt !== false) return { kind: "exempt" };
  if (["active", "trialing", "past_due"].includes(org.subscription_status ?? "")) {
    return { kind: "active", plan: org.plan, status: org.subscription_status!, renews: org.current_period_end };
  }
  const ends = new Date(org.trial_ends_at).getTime();
  if (ends > Date.now()) return { kind: "trial", daysLeft: Math.max(1, Math.ceil((ends - Date.now()) / 864e5)), endsAt: org.trial_ends_at };
  return { kind: "expired" };
}
