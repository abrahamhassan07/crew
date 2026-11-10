import { PILOT_LIMITS, TEAM_SIZES, TIER_LIMITS, type TierKey, type TierLimits } from "@/lib/plans";
import type { Organization } from "@/lib/supabase/types";

export type BillingState =
  | { kind: "exempt" }
  | { kind: "active"; plan: string | null; status: string; renews: string | null }
  | { kind: "trial"; daysLeft: number; endsAt: string }
  | { kind: "free" };

// Billing is only enforced when BILLING_ENFORCED=true, so the app can run as a
// free pilot until you're ready to charge.
export const billingEnforced = () => process.env.BILLING_ENFORCED === "true";

/**
 * Where a business stands: complimentary (exempt), paying (active), in its 60-day full trial, or on the Free plan.
 * A business whose trial or subscription has ended is never locked out: it moves to the Free plan.
 */
export function getBillingState(org: Pick<Organization, "billing_exempt" | "subscription_status" | "plan" | "current_period_end" | "trial_ends_at"> | null): BillingState {
  // `!== false` also treats a missing column (migration not applied yet) as exempt.
  if (!org || org.billing_exempt !== false) return { kind: "exempt" };
  if (["active", "trialing", "past_due"].includes(org.subscription_status ?? "")) {
    return { kind: "active", plan: org.plan, status: org.subscription_status!, renews: org.current_period_end };
  }
  const ends = new Date(org.trial_ends_at).getTime();
  if (ends > Date.now()) return { kind: "trial", daysLeft: Math.max(1, Math.ceil((ends - Date.now()) / 864e5)), endsAt: org.trial_ends_at };
  return { kind: "free" };
}

type SeatOrg = Pick<Organization, "billing_exempt" | "subscription_status" | "plan" | "current_period_end" | "trial_ends_at" | "team_size">;

/** Which plan a business is on right now: free, trial, solo, team or business. */
export function tierOf(org: SeatOrg): TierKey {
  const state = getBillingState(org);
  if (state.kind === "free") return "free";
  if (state.kind === "trial") return "trial";
  // A subscriber with an unrecognised size gets the Team limits rather than none.
  const size = TEAM_SIZES.find((t) => t.k === org.team_size)?.k;
  return size === "1" ? "solo" : size === "6-10" ? "business" : "team";
}

/** The limits that apply to a business, or null when there are none (complimentary accounts). */
export function limitsFor(org: SeatOrg | null): TierLimits | null {
  if (!org || org.billing_exempt !== false) return null;
  if (!billingEnforced()) return PILOT_LIMITS;
  return TIER_LIMITS[tierOf(org)];
}

/** Max active users for a business, or null for no limit. */
export const seatLimit = (org: SeatOrg | null): number | null => limitsFor(org)?.users ?? null;

/** Max invoices that can be sent to clients per calendar month, or null for no limit. */
export const invoiceLimit = (org: SeatOrg | null): number | null => limitsFor(org)?.invoices ?? null;

/** Monthly ceiling on all emailed quotes and invoices (resends included), or null for no cap. */
export const emailLimit = (org: SeatOrg | null): number | null => limitsFor(org)?.emails ?? null;

/** Monthly cap on reminder-type emails (customer reminders, staff schedules, review requests), or null for no cap. */
export const reminderLimit = (org: SeatOrg | null): number | null => limitsFor(org)?.reminders ?? null;

/** Xero comes with the Team plan and above (and complimentary accounts, and while billing isn't enforced). */
export function xeroAllowed(org: SeatOrg | null): boolean {
  if (!org || org.billing_exempt !== false) return true;
  return limitsFor(org)?.xero ?? true;
}

/** Whether the plan includes the AI features (Team and Business, a taste on the trial, complimentary accounts). */
export function aiAllowed(org: SeatOrg | null): boolean {
  if (!org || org.billing_exempt !== false) return true;
  return limitsFor(org)?.ai ?? true;
}

/** AI uses per month on this plan, or null for no ceiling. */
export const aiMonthlyLimit = (org: SeatOrg | null): number | null => limitsFor(org)?.aiMonthly ?? null;

/** Email kinds that share the monthly notification cap above (reminderLimit). */
export const NOTIFICATION_KINDS = ["reminder", "staff", "review"] as const;

/** Human name of the plan, for messages: "the Free plan", "the Solo plan". */
export function planName(org: SeatOrg | null): string {
  if (!org || org.billing_exempt !== false) return "your plan";
  const t = tierOf(org);
  return t === "trial" ? "the free trial" : `the ${t.charAt(0).toUpperCase()}${t.slice(1)} plan`;
}
