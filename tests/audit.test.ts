// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonthsClamped, auditServices, scheduledAuditDue, type AuditJob, type AuditService } from "../src/lib/audit/engine.ts";

let n = 0;
const svc = (o: Partial<AuditService> = {}): AuditService => ({
  id: `s${++n}`, clientId: "c1", clientName: "Helen", clientStatus: "Active", title: "Lawn mowing", jobType: "gardening",
  frequency: "weekly", intervalDays: null, anchorDate: "2026-10-05", pausedUntil: null, active: true, seriesId: "series1", ...o,
});
const job = (date: string, status = "completed", o: Partial<AuditJob> = {}): AuditJob => ({ id: `j${++n}`, clientId: "c1", jobDate: date, status, jobType: "gardening", seriesId: "series1", ...o });
const one = (s: AuditService, jobs: AuditJob[], today: string) => auditServices([s], jobs, today).items[0];

test("weekly: visits done and the next one booked is upcoming", () => {
  const i = one(svc(), [job("2026-10-05"), job("2026-10-12"), job("2026-10-19"), job("2026-10-26", "scheduled")], "2026-10-21");
  assert.equal(i.status, "upcoming");
  assert.equal(i.lastCompleted, "2026-10-19");
  assert.equal(i.nextScheduled, "2026-10-26");
});

test("weekly: due within 7 days with nothing booked is not scheduled", () => {
  const i = one(svc(), [job("2026-10-05"), job("2026-10-12"), job("2026-10-19")], "2026-10-21");
  assert.equal(i.status, "not_scheduled");
  assert.equal(i.nextExpected, "2026-10-26");
});

test("weekly: a missed visit is overdue, with days counted from the first missed date", () => {
  const i = one(svc(), [job("2026-10-05")], "2026-10-21");
  assert.equal(i.status, "overdue");
  assert.equal(i.daysOverdue, 9); // due 12 Oct
});

test("fortnightly: on track when nothing is due in the next 7 days", () => {
  const i = one(svc({ frequency: "fortnightly" }), [job("2026-10-05"), job("2026-10-19")], "2026-10-21");
  assert.equal(i.status, "on_track");
  assert.equal(i.nextExpected, "2026-11-02");
});

test("a scheduled appointment is not a delivered service", () => {
  // The 12 Oct visit is still marked scheduled (never completed): still overdue.
  const i = one(svc(), [job("2026-10-05"), job("2026-10-12", "scheduled"), job("2026-10-19", "completed")], "2026-10-21");
  assert.equal(i.status, "overdue");
});

test("overdue takes priority over a booked upcoming appointment", () => {
  const i = one(svc(), [job("2026-10-05"), job("2026-10-26", "scheduled")], "2026-10-21");
  assert.equal(i.status, "overdue");
});

test("a cancelled job does not count as delivered", () => {
  const i = one(svc(), [job("2026-10-05"), job("2026-10-12", "cancelled"), job("2026-10-19")], "2026-10-21");
  assert.equal(i.status, "overdue");
  assert.equal(i.daysOverdue, 9);
});

test("a visit rescheduled a few days late, followed by an on-time one, is not a miss", () => {
  // Due 12 Oct, done 16 Oct (rescheduled); due 19 Oct, done 19 Oct.
  const i = one(svc(), [job("2026-10-05"), job("2026-10-16"), job("2026-10-19")], "2026-10-20");
  assert.notEqual(i.status, "overdue");
});

test("monthly uses calendar months, not 30 days", () => {
  assert.equal(addMonthsClamped("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsClamped("2028-01-31", 1), "2028-02-29"); // leap year
  assert.equal(addMonthsClamped("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonthsClamped("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonthsClamped("2026-12-15", 1), "2027-01-15");
  // Due 15 Feb: one day overdue on 16 Feb (a 30-day rule would say 14 Feb, two days).
  const i = one(svc({ frequency: "monthly", anchorDate: "2026-01-15" }), [job("2026-01-15")], "2026-02-16");
  assert.equal(i.status, "overdue");
  assert.equal(i.daysOverdue, 1);
});

test("monthly on the 31st stays on track through short months", () => {
  const jobs = ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"].map((d) => job(d));
  const i = one(svc({ frequency: "monthly", anchorDate: "2026-01-31" }), jobs, "2026-05-15");
  assert.equal(i.status, "on_track");
  assert.equal(i.nextExpected, "2026-05-31");
});

test("custom interval in days", () => {
  const s = svc({ frequency: "custom", intervalDays: 10, anchorDate: "2026-10-01" });
  const i = one(s, [job("2026-10-01"), job("2026-10-11")], "2026-10-22"); // due 21 Oct, missed
  assert.equal(i.status, "overdue");
  assert.equal(i.daysOverdue, 1);
});

test("a booked appointment too far after the due date does not count as valid", () => {
  const ok = one(svc(), [job("2026-10-05"), job("2026-10-12"), job("2026-10-19"), job("2026-10-28", "scheduled")], "2026-10-21");
  assert.equal(ok.status, "upcoming"); // within half a week after the due date (26 Oct)
  const late = one(svc(), [job("2026-10-05"), job("2026-10-12"), job("2026-10-19"), job("2026-11-02", "scheduled")], "2026-10-21");
  assert.equal(late.status, "not_scheduled");
});

test("missing or invalid data needs review", () => {
  assert.equal(one(svc({ frequency: "" }), [], "2026-10-21").status, "needs_review");
  assert.equal(one(svc({ anchorDate: null }), [], "2026-10-21").status, "needs_review");
  assert.equal(one(svc({ anchorDate: "2026-13-45" }), [], "2026-10-21").status, "needs_review");
  assert.equal(one(svc({ frequency: "custom", intervalDays: null }), [], "2026-10-21").status, "needs_review");
});

test("conflicting records need review (completed job dated in the future)", () => {
  const i = one(svc({ frequency: "fortnightly" }), [job("2026-10-05"), job("2026-10-19"), job("2026-11-30", "completed")], "2026-10-21");
  assert.equal(i.status, "needs_review");
});

test("two hand-made services of the same type for one client need review", () => {
  const a = svc({ seriesId: null, title: "Mow" });
  const b = svc({ seriesId: null, title: "Edge" });
  const r = auditServices([a, b], [job("2026-10-05", "completed", { seriesId: null })], "2026-10-06");
  assert.deepEqual(r.items.map((i) => i.status), ["needs_review", "needs_review"]);
});

test("paused, inactive and non-active clients are skipped and counted", () => {
  const r = auditServices(
    [svc({ pausedUntil: "2026-12-01" }), svc({ active: false }), svc({ clientStatus: "Inactive" }), svc({ clientStatus: "Lead" }), svc({ pausedUntil: "2026-10-01" })],
    [job("2026-10-05")],
    "2026-10-21"
  );
  assert.equal(r.totals.pausedOrInactive, 4);
  assert.equal(r.items.length, 1); // a pause that has ended is audited again
});

test("totals add up and the worst cases are listed first", () => {
  const r = auditServices(
    [
      svc({ id: "a", clientId: "c1", clientName: "Aaron", frequency: "fortnightly", seriesId: "s-a" }),
      svc({ id: "b", clientId: "c2", clientName: "Bea", seriesId: "s-b" }),
      svc({ id: "c", clientId: "c3", clientName: "Cal", seriesId: "s-c" }),
    ],
    [
      job("2026-10-05", "completed", { clientId: "c1", seriesId: "s-a" }), job("2026-10-19", "completed", { clientId: "c1", seriesId: "s-a" }),
      job("2026-10-05", "completed", { clientId: "c2", seriesId: "s-b" }),
      job("2026-10-05", "completed", { clientId: "c3", seriesId: "s-c" }), job("2026-10-12", "completed", { clientId: "c3", seriesId: "s-c" }), job("2026-10-19", "completed", { clientId: "c3", seriesId: "s-c" }),
    ],
    "2026-10-21"
  );
  assert.deepEqual(r.items.map((i) => `${i.clientName}:${i.status}`), ["Bea:overdue", "Cal:not_scheduled", "Aaron:on_track"]);
  assert.equal(r.totals.recurringClients, 3);
  assert.equal(r.totals.overdue + r.totals.notScheduled + r.totals.upcoming + r.totals.onTrack + r.totals.needsReview, 3);
});

test("a service that has not started yet is on track", () => {
  const i = one(svc({ anchorDate: "2026-12-01" }), [], "2026-10-21");
  assert.equal(i.status, "on_track");
});

test("auditing is deterministic: same input, same output", () => {
  const input = [svc()];
  const jobs = [job("2026-10-05")];
  assert.deepEqual(auditServices(input, jobs, "2026-10-21"), auditServices(input, jobs, "2026-10-21"));
});

// --- Sunday 7:00 am Melbourne, across daylight saving ---------------------------------------------------------
test("scheduler: winter (AEST, UTC+10): 20:00 UTC Saturday is only 6:00 am, 21:00 UTC is 7:00 am", () => {
  assert.equal(scheduledAuditDue(new Date("2026-07-04T20:00:00Z")).due, false);
  const at7 = scheduledAuditDue(new Date("2026-07-04T21:00:00Z"));
  assert.equal(at7.due, true);
  assert.equal(at7.periodKey, "2026-07-05");
  assert.equal(scheduledAuditDue(new Date("2026-07-04T22:00:00Z")).due, true); // the daily 22:00 UTC run catches up too
});

test("scheduler: summer (AEDT, UTC+11): 20:00 UTC Saturday is 7:00 am Sunday", () => {
  const r = scheduledAuditDue(new Date("2026-12-05T20:00:00Z"));
  assert.equal(r.due, true);
  assert.equal(r.periodKey, "2026-12-06");
});

test("scheduler: the day daylight saving starts (Sun 4 Oct 2026, 2:00 -> 3:00)", () => {
  assert.equal(scheduledAuditDue(new Date("2026-10-03T19:00:00Z")).due, false); // 6:00 AEDT
  const r = scheduledAuditDue(new Date("2026-10-03T20:00:00Z")); // 7:00 AEDT
  assert.equal(r.due, true);
  assert.equal(r.periodKey, "2026-10-04");
});

test("scheduler: the day daylight saving ends (Sun 5 Apr 2026, 3:00 -> 2:00)", () => {
  assert.equal(scheduledAuditDue(new Date("2026-04-04T20:00:00Z")).due, false); // 6:00 AEST
  const r = scheduledAuditDue(new Date("2026-04-04T21:00:00Z")); // 7:00 AEST
  assert.equal(r.due, true);
  assert.equal(r.periodKey, "2026-04-05");
});

test("scheduler: not due on other days or before 7:00", () => {
  assert.equal(scheduledAuditDue(new Date("2026-10-03T12:00:00Z")).due, false); // Saturday night local
  assert.equal(scheduledAuditDue(new Date("2026-10-05T21:00:00Z")).due, false); // Tuesday
  assert.equal(scheduledAuditDue(new Date("2026-10-03T14:00:00Z")).due, false); // Sunday 1:00 am local
});

// --- Summaries: AI may only rephrase verified numbers --------------------------------------------------------
import { acceptAiSummary, aiFacts, auditCsv, plainSummary } from "../src/lib/audit/summary.ts";

const totals = { recurringClients: 18, overdue: 6, notScheduled: 9, upcoming: 2, onTrack: 1, needsReview: 0, pausedOrInactive: 3 };

test("plain summary states only the verified counts", () => {
  const s = plainSummary(totals);
  assert.match(s, /18 recurring clients were audited/);
  assert.match(s, /6 recurring services are overdue/);
  assert.match(s, /9 clients need an appointment/);
  assert.doesNotMatch(s, /needs? a manual check/); // zero needs-review is not mentioned
  assert.match(plainSummary({ ...totals, recurringClients: 0, overdue: 0, notScheduled: 0, upcoming: 0, onTrack: 0 }), /nothing to audit/);
});

test("AI text is rejected if it contains a number that isn't in the data", () => {
  const { allowedNumbers } = aiFacts(totals, []);
  assert.ok(acceptAiSummary("Six clients are overdue and nine need scheduling for next week.", allowedNumbers));
  assert.equal(acceptAiSummary("Seven clients are overdue and nine need scheduling for next week.", allowedNumbers) === null, false); // 7 is always allowed (the 7-day window)
  assert.equal(acceptAiSummary("Eleven clients are overdue and nine need scheduling for next week.", allowedNumbers), null);
  assert.equal(acceptAiSummary("14 clients are overdue and 9 need scheduling for next week.", allowedNumbers), null);
  assert.equal(acceptAiSummary("Short", allowedNumbers), null);
  assert.equal(acceptAiSummary("<b>Six clients</b> are overdue and nine need scheduling next week.", allowedNumbers), null);
});

test("CSV escapes quotes and blocks spreadsheet formulas", () => {
  const csv = auditCsv([{ client_name: '=HYPERLINK("x")', service_title: 'Mow, "edge"', frequency: "custom", interval_days: 10, last_completed: "2026-10-01", next_expected: "2026-10-11", next_scheduled: null, days_overdue: 3, status: "overdue", reason: "ok" }]);
  const [head, row] = csv.split("\r\n");
  assert.match(head, /^Client,Service,Frequency/);
  assert.match(row, /^"'=HYPERLINK\(""x""\)","Mow, ""edge""",Every 10 days,2026-10-01,2026-10-11,,3,Overdue,ok$/);
});
