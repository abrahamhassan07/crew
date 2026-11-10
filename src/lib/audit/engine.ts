// Client Service Auditor: the deterministic core. No database, no AI, no clocks: give it today's local date and the
// records and it returns the same answer every time. All dates are plain local calendar dates ("YYYY-MM-DD"), never
// timestamps, so daylight saving can't shift a result. AI is only ever asked to *describe* what this returns.
// Keep this file free of imports so it can be unit-tested directly (tests/audit.test.ts).

export type Frequency = "weekly" | "fortnightly" | "monthly" | "custom";
export type AuditStatus = "overdue" | "not_scheduled" | "upcoming" | "on_track" | "needs_review";

export interface AuditService {
  id: string;
  clientId: string;
  clientName: string;
  clientStatus: string; // Lead | Active | Inactive | Archived
  title: string;
  jobType: string; // cleaning | gardening | both
  frequency: string;
  intervalDays: number | null;
  anchorDate: string | null;
  pausedUntil: string | null;
  active: boolean;
  seriesId: string | null;
}

export interface AuditJob {
  id: string;
  clientId: string | null;
  jobDate: string | null;
  status: string; // scheduled | in_progress | completed | cancelled
  jobType: string;
  seriesId: string | null;
}

export interface AuditItem {
  serviceId: string;
  clientId: string;
  clientName: string;
  serviceTitle: string;
  frequency: string;
  intervalDays: number | null;
  lastCompleted: string | null;
  nextExpected: string | null;
  nextScheduled: string | null;
  daysOverdue: number;
  status: AuditStatus;
  reason: string;
}

export interface AuditTotals {
  recurringClients: number; // distinct clients with an audited service
  overdue: number;
  notScheduled: number;
  upcoming: number;
  onTrack: number;
  needsReview: number;
  pausedOrInactive: number; // services skipped: paused, inactive client or switched off
}

export interface AuditResult {
  items: AuditItem[];
  totals: AuditTotals;
}

export const UPCOMING_WINDOW_DAYS = 7;
/** Only look back this far for missed visits, so an old service doesn't bury the report in ancient history. */
export const LOOKBACK_DAYS = 56;

// ---------------------------------------------------------------------------
// Local calendar-date arithmetic (UTC maths on the date parts, so no DST can interfere)
// ---------------------------------------------------------------------------
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string | null | undefined): s is string {
  if (!s) return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const toUtc = (iso: string) => {
  const m = DATE_RE.exec(iso)!;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDaysIso = (iso: string, days: number) => fromUtc(toUtc(iso) + days * 86_400_000);
export const diffDays = (a: string, b: string) => Math.round((toUtc(a) - toUtc(b)) / 86_400_000);

/**
 * Adds calendar months and keeps the original day of the month, clamped to the month's last day:
 * anchor 31 Jan -> 28 Feb (29 in a leap year) -> 31 Mar. Never "30 days".
 */
export function addMonthsClamped(anchorIso: string, months: number): string {
  const m = DATE_RE.exec(anchorIso)!;
  const y = +m[1];
  const mo = +m[2] - 1 + months;
  const targetYear = y + Math.floor(mo / 12);
  const targetMonth = ((mo % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(targetYear, targetMonth, Math.min(+m[3], lastDay)));
}

/** The n-th expected visit date (n = 0 is the anchor date). */
export function occurrence(anchor: string, frequency: string, intervalDays: number | null, n: number): string {
  if (frequency === "weekly") return addDaysIso(anchor, 7 * n);
  if (frequency === "fortnightly") return addDaysIso(anchor, 14 * n);
  if (frequency === "monthly") return addMonthsClamped(anchor, n);
  return addDaysIso(anchor, (intervalDays as number) * n);
}

// ---------------------------------------------------------------------------
// Which jobs count towards which service
// ---------------------------------------------------------------------------
function jobBelongsTo(job: AuditJob, svc: AuditService): boolean {
  if (job.clientId !== svc.clientId) return false;
  if (svc.seriesId) return job.seriesId === svc.seriesId;
  // A service added by hand has no series: match on the kind of work.
  return svc.jobType === "both" || job.jobType === svc.jobType || job.jobType === "both";
}

const isValidFrequency = (svc: AuditService) =>
  ["weekly", "fortnightly", "monthly"].includes(svc.frequency) || (svc.frequency === "custom" && Number.isInteger(svc.intervalDays) && (svc.intervalDays as number) >= 1 && (svc.intervalDays as number) <= 365);

// ---------------------------------------------------------------------------
// Auditing one service
// ---------------------------------------------------------------------------
function auditOne(svc: AuditService, jobs: AuditJob[], today: string, ambiguous: boolean): AuditItem {
  const base = {
    serviceId: svc.id,
    clientId: svc.clientId,
    clientName: svc.clientName,
    serviceTitle: svc.title,
    frequency: svc.frequency,
    intervalDays: svc.intervalDays,
    lastCompleted: null as string | null,
    nextExpected: null as string | null,
    nextScheduled: null as string | null,
    daysOverdue: 0,
  };
  const review = (reason: string): AuditItem => ({ ...base, status: "needs_review", reason });

  // Not enough information to judge confidently.
  if (!isValidFrequency(svc)) return review("The service has no valid frequency.");
  if (!isIsoDate(svc.anchorDate)) return review("The service has no valid start date.");
  const anchor = svc.anchorDate;

  const mine = jobs.filter((j) => jobBelongsTo(j, svc) && isIsoDate(j.jobDate));
  const completed = mine.filter((j) => j.status === "completed");
  const completedPast = completed.filter((j) => (j.jobDate as string) <= today);
  const completedFuture = completed.filter((j) => (j.jobDate as string) > today);
  const open = mine.filter((j) => (j.status === "scheduled" || j.status === "in_progress") && (j.jobDate as string) >= today);

  base.lastCompleted = completedPast.reduce<string | null>((m, j) => (m === null || (j.jobDate as string) > m ? (j.jobDate as string) : m), null);
  base.nextScheduled = open.reduce<string | null>((m, j) => (m === null || (j.jobDate as string) < m ? (j.jobDate as string) : m), null);

  // Expected dates from the anchor up to a week past today, plus one more to know the gap after the last one.
  const horizon = addDaysIso(today, UPCOMING_WINDOW_DAYS);
  const dates: string[] = [];
  for (let n = 0; n < 6000; n++) {
    const d = occurrence(anchor, svc.frequency, svc.intervalDays, n);
    dates.push(d);
    if (dates.length > 1 && dates[dates.length - 2] > horizon) break;
  }

  // Match completed visits to expected dates one-to-one, earliest date first. A visit can count for a due date if it
  // happened up to half a period early or just before the next due date, and the closest visit wins. So one late
  // visit followed by an on-time one satisfies both dates instead of looking like a miss.
  const delivered = new Set<number>();
  const used = new Set<number>();
  for (let k = 0; k < dates.length - 1; k++) {
    const d = dates[k];
    const gapPrev = k > 0 ? diffDays(d, dates[k - 1]) : diffDays(dates[1], d);
    const gapNext = diffDays(dates[k + 1], d);
    const lo = addDaysIso(d, -Math.floor(gapPrev / 2));
    const hi = addDaysIso(d, gapNext - 1);
    let best = -1;
    let bestGap = Infinity;
    for (let j = 0; j < completedPast.length; j++) {
      if (used.has(j)) continue;
      const jd = completedPast[j].jobDate as string;
      if (jd < lo || jd > hi) continue;
      const gap = Math.abs(diffDays(jd, d));
      if (gap < bestGap || (gap === bestGap && jd < (completedPast[best].jobDate as string))) {
        bestGap = gap;
        best = j;
      }
    }
    if (best >= 0) {
      used.add(best);
      delivered.add(k);
    }
  }

  // Missed visits: a due date that has passed (inside the lookback) with no completed visit for it.
  const lookbackStart = addDaysIso(today, -LOOKBACK_DAYS);
  let firstMissed: string | null = null;
  for (let k = 0; k < dates.length; k++) {
    const d = dates[k];
    if (d >= today) break;
    if (d >= lookbackStart && !delivered.has(k)) {
      firstMissed = d;
      break;
    }
  }

  // The next date that still needs a visit (today or later, not already covered by an early visit).
  let nextIdx = -1;
  for (let k = 0; k < dates.length; k++) {
    if (dates[k] >= today && !delivered.has(k)) {
      nextIdx = k;
      break;
    }
  }
  base.nextExpected = nextIdx >= 0 ? dates[nextIdx] : null;

  // Overdue always wins, even when other records look odd.
  if (firstMissed) {
    return { ...base, status: "overdue", daysOverdue: diffDays(today, firstMissed), reason: `A visit was due on ${firstMissed} and no completed job is recorded for it.` };
  }

  // Conflicting records we can't safely interpret.
  if (completedFuture.length > 0) return review("A job is marked completed but dated in the future.");
  if (ambiguous) return review("The client has several services of the same type, so jobs can't be matched to this one.");

  if (nextIdx < 0) return review("Couldn't work out the next expected visit.");
  const nextDue = dates[nextIdx];
  if (diffDays(nextDue, today) > UPCOMING_WINDOW_DAYS) return { ...base, status: "on_track", reason: "Nothing is due in the next 7 days." };

  // Due within 7 days: is there a real appointment for it? Between today and halfway to the visit after.
  const after = dates[nextIdx + 1] ?? nextDue;
  const latestOk = addDaysIso(nextDue, Math.floor(diffDays(after, nextDue) / 2));
  const valid = open.some((j) => (j.jobDate as string) >= today && (j.jobDate as string) <= latestOk);
  return valid
    ? { ...base, status: "upcoming", reason: `Due ${nextDue} and an appointment is booked.` }
    : { ...base, status: "not_scheduled", reason: `Due ${nextDue} but no appointment is booked.` };
}

/** Audits every recurring service. `today` is the business's local date. */
export function auditServices(services: AuditService[], jobs: AuditJob[], today: string): AuditResult {
  const items: AuditItem[] = [];
  let skipped = 0;

  // Two hand-made services of the same type for one client can't be told apart from their jobs.
  const keyCount = new Map<string, number>();
  const keyOf = (s: AuditService) => `${s.clientId}|${s.seriesId ? `series:${s.seriesId}` : `type:${s.jobType}`}`;
  for (const s of services) keyCount.set(keyOf(s), (keyCount.get(keyOf(s)) ?? 0) + 1);

  for (const svc of services) {
    const paused = svc.pausedUntil && isIsoDate(svc.pausedUntil) && svc.pausedUntil > today;
    if (!svc.active || paused || svc.clientStatus !== "Active") {
      skipped++;
      continue;
    }
    items.push(auditOne(svc, jobs, today, !svc.seriesId && (keyCount.get(keyOf(svc)) ?? 0) > 1));
  }

  // Worst first, then by how long overdue, then name: the order a person wants to read it in.
  const rank: Record<AuditStatus, number> = { overdue: 0, not_scheduled: 1, needs_review: 2, upcoming: 3, on_track: 4 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || b.daysOverdue - a.daysOverdue || a.clientName.localeCompare(b.clientName));

  const count = (s: AuditStatus) => items.filter((i) => i.status === s).length;
  return {
    items,
    totals: {
      recurringClients: new Set(items.map((i) => i.clientId)).size,
      overdue: count("overdue"),
      notScheduled: count("not_scheduled"),
      upcoming: count("upcoming"),
      onTrack: count("on_track"),
      needsReview: count("needs_review"),
      pausedOrInactive: skipped,
    },
  };
}

// ---------------------------------------------------------------------------
// Sunday 7:00 am Melbourne
// ---------------------------------------------------------------------------
export const AUDIT_TZ = "Australia/Melbourne";

/** The local date, weekday and clock time in Melbourne for an instant (correct across daylight saving changes). */
export function localParts(now: Date, tz: string = AUDIT_TZ): { date: string; weekday: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday, hour: +get("hour"), minute: +get("minute") };
}

/**
 * Whether the weekly scheduled audit is due at this moment, and its period key (that Sunday's local date).
 * Due from 7:00 am Melbourne time on Sunday. The scheduler may call this several times that morning (two cron
 * entries, retries); the database's one-report-per-period rule makes every extra call harmless.
 */
export function scheduledAuditDue(now: Date, tz: string = AUDIT_TZ): { due: boolean; periodKey: string; today: string } {
  const p = localParts(now, tz);
  return { due: p.weekday === 0 && p.hour >= 7, periodKey: p.date, today: p.date };
}
