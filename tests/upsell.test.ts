import { test } from "node:test";
import assert from "node:assert/strict";
import { NOT_IN_PLAN, stripUpsell } from "../src/lib/upsell.ts";

test("keeps the facts and drops the upgrade prompt", () => {
  assert.equal(
    stripUpsell("You've sent 50 of 50 invoices this month, which is the limit on Free. Upgrade under Subscription to send more. The count starts again on the 1st."),
    "You've sent 50 of 50 invoices this month, which is the limit on Free. The count starts again on the 1st."
  );
  assert.equal(stripUpsell("You've used your 20 free AI uses this month. Upgrade to the Team plan to keep using AI features."), "You've used your 20 free AI uses this month.");
});

test("falls back to a neutral line when everything was a prompt", () => {
  assert.equal(stripUpsell("Job photos are included with the Team and Business plans. Upgrade under Subscription to add photos."), NOT_IN_PLAN);
  assert.equal(stripUpsell("Xero is included with the Team plan (2–5 users) and above. See plans to upgrade."), NOT_IN_PLAN);
  assert.equal(stripUpsell("AI features are included with the Team and Business plans. Upgrade under Subscription to use them."), NOT_IN_PLAN);
});

test("leaves ordinary messages alone", () => {
  const m = "Voice-to-Quote is switched off. An owner can turn it on under Settings > AI Features.";
  assert.equal(stripUpsell(m), m);
});
