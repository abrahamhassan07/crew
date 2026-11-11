import test from "node:test";
import assert from "node:assert/strict";
import { TIER_LIMITS, PILOT_LIMITS } from "../src/lib/plans.ts";

test("job photos are a Team and Business feature, plus the trial", () => {
  assert.equal(TIER_LIMITS.free.photos, false);
  assert.equal(TIER_LIMITS.solo.photos, false);
  assert.equal(TIER_LIMITS.trial.photos, true);
  assert.equal(TIER_LIMITS.team.photos, true);
  assert.equal(TIER_LIMITS.business.photos, true);
  assert.equal(PILOT_LIMITS.photos, true);
});
