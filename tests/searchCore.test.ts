import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchPattern } from "../src/lib/searchCore.ts";

test("too short or empty searches nothing", () => {
  assert.equal(buildSearchPattern(""), null);
  assert.equal(buildSearchPattern("  a "), null);
});

test("plain words become a quoted contains pattern", () => {
  assert.equal(buildSearchPattern("  Gloria   Car "), '"%Gloria Car%"');
});

test("LIKE wildcards are matched literally", () => {
  assert.equal(buildSearchPattern("50%_off"), '"%50\\\\%\\\\_off%"');
});

test("commas, brackets and quotes can't break out of the filter", () => {
  const p = buildSearchPattern('a,b),name.eq."x');
  assert.ok(p!.startsWith('"%') && p!.endsWith('%"'));
  // The only unescaped double quotes are the outer ones.
  assert.equal(p!.slice(1, -1).replace(/\\"/g, "").includes('"'), false);
});

test("very long input is cut short", () => {
  assert.ok(buildSearchPattern("x".repeat(500))!.length < 80);
});

import { friendlyDate, orderJobs } from "../src/lib/searchCore.ts";

test("dates read like people write them", () => {
  assert.equal(friendlyDate("2026-05-01", 2026), "1 May");
  assert.equal(friendlyDate("2027-05-01", 2026), "1 May 2027");
  assert.equal(friendlyDate(null), "");
});

test("upcoming jobs first (soonest first), then recent past, then unscheduled", () => {
  const jobs = [{ id: "far", job_date: "2027-05-01" }, { id: "past1", job_date: "2026-11-10" }, { id: "none", job_date: null }, { id: "soon", job_date: "2026-11-20" }, { id: "past2", job_date: "2026-10-01" }, { id: "today", job_date: "2026-11-17" }];
  assert.deepEqual(orderJobs(jobs, "2026-11-17").map((j) => j.id), ["today", "soon", "far", "past1", "past2", "none"]);
});
