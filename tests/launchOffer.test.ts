// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { LAUNCH_OFFER, TEAM_SIZES, TIER_LIMITS, launchOfferOpen, launchPriceFor } from "../src/lib/plans.ts";

const solo = TEAM_SIZES.find((t) => t.k === "1")!;
const team = TEAM_SIZES.find((t) => t.k === "2-5")!;
// Noon Sydney time on the offer's last day, and the next day.
const lastDay = new Date(`${LAUNCH_OFFER.lastDay}T01:00:00Z`);
const dayAfter = new Date(lastDay.getTime() + 864e5);

test("the launch price applies to Solo billed monthly while the offer is open", () => {
  assert.equal(launchPriceFor(solo, false, lastDay), LAUNCH_OFFER.price);
});

test("no launch price on annual billing or other team sizes", () => {
  assert.equal(launchPriceFor(solo, true, lastDay), null);
  assert.equal(launchPriceFor(team, false, lastDay), null);
});

test("the offer closes after its last day (Sydney time)", () => {
  assert.equal(launchOfferOpen(lastDay), true);
  assert.equal(launchOfferOpen(dayAfter), false);
  assert.equal(launchPriceFor(solo, false, dayAfter), null);
});

test("the discount is a whole number of cents and less than the normal price", () => {
  const cents = (solo.price - LAUNCH_OFFER.price) * 100;
  assert.equal(Math.round(cents), 1201);
  assert.ok(LAUNCH_OFFER.price < solo.price);
});

test("Solo includes Xero; the trial and Free plan don't", () => {
  assert.equal(TIER_LIMITS.solo.xero, true);
  assert.equal(TIER_LIMITS.trial.xero, false);
  assert.equal(TIER_LIMITS.free.xero, false);
});
