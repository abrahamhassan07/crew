import test from "node:test";
import assert from "node:assert/strict";
import { RECURRENCE_LABEL, RECURRENCE_STEP_DAYS } from "../src/lib/recurrence.ts";

test("every 3 weeks steps 21 days and has a readable label", () => {
  assert.equal(RECURRENCE_STEP_DAYS.every3weeks, 21);
  assert.equal(RECURRENCE_STEP_DAYS.every4weeks, 28);
  assert.equal(RECURRENCE_LABEL.every4weeks, "Every 4 weeks");
  assert.equal(RECURRENCE_STEP_DAYS.weekly, 7);
  assert.equal(RECURRENCE_STEP_DAYS.fortnightly, 14);
  assert.equal(RECURRENCE_STEP_DAYS.monthly, undefined);
  assert.equal(RECURRENCE_LABEL.every3weeks, "Every 3 weeks");
});
