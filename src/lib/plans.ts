export const TEAM_SIZES = [
  { k: "1", label: "Just me", users: 1, mult: 1 },
  { k: "2-5", label: "2–5 users", users: 5, mult: 1.8 },
  { k: "6-10", label: "6–10 users", users: 10, mult: 3 },
  { k: "11-20", label: "11–20 users", users: 20, mult: 5 },
  { k: "21+", label: "21+ users", users: 999, mult: 8 },
] as const;

export type TeamSize = (typeof TEAM_SIZES)[number];

export interface Plan {
  k: string;
  rank: number;
  name: string;
  base: number;
  max: number;
  blurb: string;
  lead: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    k: "starter",
    rank: 1,
    name: "Starter",
    base: 39,
    max: 5,
    blurb: "For sole traders getting organised with quoting, scheduling and invoicing.",
    lead: "What's included",
    features: [
      "Client records with multiple properties",
      "Quotes and tax invoices with GST",
      "Day, week and month scheduling",
      "Service catalogue and price list",
      "Basic reporting",
    ],
  },
  {
    k: "growth",
    rank: 2,
    name: "Growth",
    base: 99,
    max: 999,
    blurb: "For growing teams running multiple crews and recurring work.",
    lead: "Everything in Starter, plus",
    features: [
      "Crew scheduling with drag and drop",
      "Recurring jobs and visit series",
      "Job checklists and before/after photos",
      "Booking requests from your website",
      "Automated quote follow-ups",
    ],
  },
  {
    k: "professional",
    rank: 3,
    name: "Professional",
    base: 189,
    max: 999,
    blurb: "For established operators who need deeper insight and control.",
    lead: "Everything in Growth, plus",
    features: [
      "Crew utilisation and profitability reports",
      "Equipment tracking and service reminders",
      "Custom roles and permissions",
      "Marketing campaigns and review requests",
      "Priority support",
    ],
  },
];

export function priceFor(plan: Plan, team: TeamSize, annual: boolean) {
  const monthly = Math.round(plan.base * team.mult);
  const now = annual ? Math.round(monthly * 0.8) : monthly;
  return { monthly, now };
}
