// One plan, priced by team size. Everything is included; the team size sets the
// price and the number of active users (seats) a business can have.
export const TEAM_SIZES = [
  { k: "1", label: "Just me", users: 1, price: 19 },
  { k: "2-5", label: "2–5 users", users: 5, price: 39 },
  { k: "6-10", label: "6–10 users", users: 10, price: 65 },
  { k: "11-20", label: "11–20 users", users: 20, price: 109 },
  { k: "21+", label: "21+ users", users: 999, price: 169 },
] as const;

export type TeamSize = (typeof TEAM_SIZES)[number];

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
    "Logins for your whole team",
    "Email support",
  ],
};

export function priceFor(team: TeamSize, annual: boolean) {
  const monthly = team.price;
  const now = annual ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) : monthly;
  return { monthly, now };
}
