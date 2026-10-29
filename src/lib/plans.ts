// A Free plan plus three paid sizes. Every plan has the same features (Xero is Team and above); what changes is the
// number of users (seats) and how many invoices can be sent each month. `invoices` is a monthly cap on invoices
// sent to clients (drafts and quotes don't count).
export const TEAM_SIZES = [
  { k: "1", name: "Solo", label: "Just me", users: 1, invoices: 100, price: 19 },
  { k: "2-5", name: "Team", label: "2–5 users", users: 5, invoices: 200, price: 39 },
  { k: "6-10", name: "Business", label: "6–10 users", users: 10, invoices: 300, price: 65 },
] as const;

/** The Free plan: always available, no card. Every new business starts with a full trial and falls back to this. */
export const FREE_PLAN = { name: "Free", label: "Just me", users: 1, invoices: 20 } as const;

export type TeamSize = (typeof TEAM_SIZES)[number];

/** The "trial ends in N days" banner only appears in the last this-many days of the trial. */
export const TRIAL_REMINDER_DAYS = 14;

/** How long the full-featured free trial lasts (the database default for new businesses; see migration 0021). */
export const TRIAL_DAYS = 60;
export const ANNUAL_DISCOUNT = 0.2;

export const PLAN = {
  k: "standard",
  name: "Crew & Grounds",
  blurb: "Everything you need to quote, schedule, invoice and run your crews. Priced by the size of your team.",
  features: [
    "Clients with multiple properties and contacts",
    "Quotes and invoices, emailed to clients as PDFs",
    "Scheduling in day, week, month and crew views, with drag and drop",
    "Recurring jobs",
    "Service price list",
    "Equipment tracking",
    "Reports, including crew utilisation",
    "Xero integration, Team plan and above: invoices you send are copied into Xero",
    "Logins for your whole team",
    "Email support",
  ],
};

export const POPULAR_TEAM = "2-5";

/** Cost per user when the team is full, e.g. $7.80 for 5 users on $39. */
export function perUser(team: TeamSize) {
  const v = team.price / team.users;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

export function priceFor(team: TeamSize, annual: boolean) {
  const monthly = team.price;
  const now = annual ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) : monthly;
  return { monthly, now };
}

export type TierKey = "free" | "trial" | "solo" | "team" | "business";

export interface TierLimits {
  /** Active users (seats); null = no limit. */
  users: number | null;
  /** Invoices sent to clients per calendar month (first send only); null = no limit. */
  invoices: number | null;
  /** All quote and invoice emails per month, resends included. A safety ceiling above the invoice cap. */
  emails: number | null;
  /** Reminder-type emails per month: customer reminders, staff schedules and review requests share this. */
  reminders: number | null;
  /** Xero integration (Team and above). It stays off during the trial: Xero limits how many businesses one app can connect. */
  xero: boolean;
}

const paid = (k: (typeof TEAM_SIZES)[number]["k"]): Omit<TierLimits, "xero"> => {
  const t = TEAM_SIZES.find((x) => x.k === k)!;
  return { users: t.users, invoices: t.invoices, emails: t.invoices * 2, reminders: 1000 };
};

export const TIER_LIMITS: Record<TierKey, TierLimits> = {
  free: { users: FREE_PLAN.users, invoices: FREE_PLAN.invoices, emails: FREE_PLAN.invoices * 2, reminders: 20, xero: false },
  trial: { users: 5, invoices: 100, emails: 200, reminders: 100, xero: false },
  solo: { ...paid("1"), xero: false },
  team: { ...paid("2-5"), xero: true },
  business: { ...paid("6-10"), xero: true },
};

/** Used while billing isn't enforced (a free pilot, local development): generous, and Xero is open. */
export const PILOT_LIMITS: TierLimits = { users: null, invoices: 100, emails: 200, reminders: 300, xero: true };
