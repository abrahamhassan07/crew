// One plan, priced by team size. Everything is included; the team size sets the
// price and the number of active users (seats) a business can have.
export const TEAM_SIZES = [
  { k: "1", name: "Solo", label: "Just me", users: 1, price: 19 },
  { k: "2-5", name: "Team", label: "2–5 users", users: 5, price: 39 },
  { k: "6-10", name: "Business", label: "6–10 users", users: 10, price: 65 },
] as const;

export type TeamSize = (typeof TEAM_SIZES)[number];

/** The "trial ends in N days" banner only appears in the last this-many days of the trial. */
export const TRIAL_REMINDER_DAYS = 14;

/** Users allowed during the free trial. */
export const TRIAL_USERS = 5;
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
    "Xero integration: invoices you send are copied into Xero",
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

/**
 * Emailed quotes + invoices allowed per business per month. Trial mirrors the free
 * tier of common invoicing apps (20); the pilot value applies while billing isn't
 * enforced yet; paying businesses get a generous cap that still stops abuse.
 */
export const EMAIL_LIMITS = { trial: 20, pilot: 100, paid: 300 } as const;

/** Customer reminder emails allowed per business per month (separate from the quote/invoice cap). */
export const REMINDER_LIMITS = { trial: 20, pilot: 300, paid: 1000 } as const;
