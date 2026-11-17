import { test } from "node:test";
import assert from "node:assert/strict";
import { businessNameMatches, deletionKind, signedInRecently, subscriptionNeedsCancelling } from "../src/lib/accountDeletionCore.ts";

test("who deletes what", () => {
  assert.equal(deletionKind("staff", 0), "staff");
  assert.equal(deletionKind("staff", 3), "staff");
  assert.equal(deletionKind("admin", 1), "admin");
  assert.equal(deletionKind("admin", 0), "business");
});

test("business name confirmation is forgiving about case and spaces, strict about words", () => {
  assert.equal(businessNameMatches("  green  thumb gardening ", "Green Thumb Gardening"), true);
  assert.equal(businessNameMatches("O’Brien's Lawns", "O'Brien's Lawns"), true);
  assert.equal(businessNameMatches("Green Thumb", "Green Thumb Gardening"), false);
  assert.equal(businessNameMatches("", ""), false);
  assert.equal(businessNameMatches("anything", "   "), false);
});

test("recent sign-in comes from the newest amr time", () => {
  const now = 1_800_000_000;
  assert.equal(signedInRecently([{ method: "password", timestamp: now - 60 }], now), true);
  assert.equal(signedInRecently([{ method: "password", timestamp: now - 3600 }, { method: "totp", timestamp: now - 120 }], now), true);
  assert.equal(signedInRecently([{ method: "oauth", timestamp: now - 16 * 60 }], now), false);
  assert.equal(signedInRecently([{ method: "password", timestamp: now + 3600 }], now), false); // clock nonsense
  assert.equal(signedInRecently(["password"], now), false);
  assert.equal(signedInRecently(undefined, now), false);
});

test("only live subscriptions are cancelled first", () => {
  assert.equal(subscriptionNeedsCancelling("active", "sub_1"), true);
  assert.equal(subscriptionNeedsCancelling("trialing", "sub_1"), true);
  assert.equal(subscriptionNeedsCancelling("past_due", "sub_1"), true);
  assert.equal(subscriptionNeedsCancelling("canceled", "sub_1"), false);
  assert.equal(subscriptionNeedsCancelling("active", null), false);
});
