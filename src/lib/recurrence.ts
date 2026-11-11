import type { Recurrence } from "@/lib/supabase/types";

/** Plain-English name for a job's repeat setting. */
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Does not repeat",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  every3weeks: "Every 3 weeks",
  every4weeks: "Every 4 weeks",
  monthly: "Monthly",
};

/** Days between visits for the fixed-length repeats; monthly is calendar-based so it has none. */
export const RECURRENCE_STEP_DAYS: Partial<Record<Recurrence, number>> = { weekly: 7, fortnightly: 14, every3weeks: 21, every4weeks: 28 };
