// Wording for audit reports. Deterministic text is always produced; AI may only rephrase it, and its answer is
// rejected if it mentions any number that isn't in the verified data. No imports, so it's unit-testable.
import type { AuditItem, AuditTotals } from "./engine.ts";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The summary used when AI is off, unavailable or rejected. Built only from verified numbers. */
export function plainSummary(t: AuditTotals): string {
  if (t.recurringClients === 0) return "No recurring clients are set up yet, so there was nothing to audit. Add a repeating job or a recurring service to a client to start tracking.";
  const parts: string[] = [];
  if (t.overdue) parts.push(`${plural(t.overdue, "recurring service is", "recurring services are")} overdue.`);
  if (t.notScheduled) parts.push(`${plural(t.notScheduled, "client needs", "clients need")} an appointment booked for the coming week.`);
  if (t.upcoming) parts.push(`${plural(t.upcoming, "service is", "services are")} booked for the coming week.`);
  if (t.needsReview) parts.push(`${plural(t.needsReview, "service needs", "services need")} a manual check because the records are incomplete or conflicting.`);
  parts.push(`${plural(t.onTrack, "service is", "services are")} on track.`);
  return `${plural(t.recurringClients, "recurring client was", "recurring clients were")} audited. ${parts.join(" ")}`;
}

/** Counts the model may rely on: totals plus a breakdown of problems by frequency, with no client names. */
export function aiFacts(t: AuditTotals, items: AuditItem[]): { facts: Record<string, unknown>; allowedNumbers: Set<number> } {
  const byFrequency: Record<string, { overdue: number; notScheduled: number }> = {};
  for (const i of items) {
    if (i.status !== "overdue" && i.status !== "not_scheduled") continue;
    const f = (byFrequency[i.frequency] ??= { overdue: 0, notScheduled: 0 });
    if (i.status === "overdue") f.overdue++;
    else f.notScheduled++;
  }
  const facts = { totals: t, problemsByFrequency: byFrequency, longestOverdueDays: Math.max(0, ...items.filter((i) => i.status === "overdue").map((i) => i.daysOverdue)) };
  const allowed = new Set<number>([0, 1, 7]);
  const walk = (v: unknown) => {
    if (typeof v === "number") allowed.add(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return { facts, allowedNumbers: allowed };
}

const WORD_NUMBERS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/** True if every number in the text (digits or small number words) is one of the verified numbers. */
export function numbersAreVerified(text: string, allowed: Set<number>): boolean {
  for (const m of text.matchAll(/\b\d+\b/g)) if (!allowed.has(Number(m[0]))) return false;
  for (const m of text.toLowerCase().matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g)) {
    // "one" is common English ("no one"); only check it when it's next to a counted noun.
    if (m[1] === "one" && !/\bone\s+(client|clients|service|services|visit|appointment)\b/i.test(text)) continue;
    if (!allowed.has(WORD_NUMBERS[m[1]])) return false;
  }
  return true;
}

/** Accepts the model's text only if it is short, plain and uses only verified numbers. */
export function acceptAiSummary(text: string, allowed: Set<number>): string | null {
  const t = text.trim();
  if (t.length < 20 || t.length > 900) return null;
  if (/[<>{}]|https?:\/\//.test(t)) return null;
  return numbersAreVerified(t, allowed) ? t : null;
}

// ---------------------------------------------------------------------------
// CSV (client-side download and tests)
// ---------------------------------------------------------------------------
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Cells starting with = + - @ would run as formulas in a spreadsheet; prefix them.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const STATUS_LABEL: Record<string, string> = { overdue: "Overdue", not_scheduled: "Not scheduled", upcoming: "Upcoming", on_track: "On track", needs_review: "Needs review" };
export const FREQUENCY_LABEL = (f: string, interval: number | null) => (f === "custom" ? `Every ${interval ?? "?"} days` : f.charAt(0).toUpperCase() + f.slice(1));

export function auditCsv(items: { client_name: string; service_title: string; frequency: string; interval_days: number | null; last_completed: string | null; next_expected: string | null; next_scheduled: string | null; days_overdue: number; status: string; reason: string }[]): string {
  const head = ["Client", "Service", "Frequency", "Last completed", "Next expected", "Next scheduled appointment", "Days overdue", "Status", "Note"];
  const rows = items.map((i) => [i.client_name, i.service_title, FREQUENCY_LABEL(i.frequency, i.interval_days), i.last_completed ?? "", i.next_expected ?? "", i.next_scheduled ?? "", i.status === "overdue" ? i.days_overdue : "", STATUS_LABEL[i.status] ?? i.status, i.reason]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
