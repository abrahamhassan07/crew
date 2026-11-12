import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanChecklist, MAX_CHECKLIST_ITEMS, MAX_CHECKLIST_TEXT } from "../src/lib/checklist.ts";

test("keeps well-formed items and drops extra fields", () => {
  assert.deepEqual(cleanChecklist([{ t: "Mow front", done: true, x: 1 }, { t: "Edges", done: false }]), [
    { t: "Mow front", done: true },
    { t: "Edges", done: false },
  ]);
  assert.deepEqual(cleanChecklist([]), []);
});

test("rejects malformed lists", () => {
  assert.equal(cleanChecklist(null), null);
  assert.equal(cleanChecklist("x"), null);
  assert.equal(cleanChecklist([{ t: "a", done: "yes" }]), null);
  assert.equal(cleanChecklist([{ t: 5, done: true }]), null);
  assert.equal(cleanChecklist([null]), null);
  assert.equal(cleanChecklist(Array.from({ length: MAX_CHECKLIST_ITEMS + 1 }, () => ({ t: "a", done: false }))), null);
});

test("trims very long item text", () => {
  const out = cleanChecklist([{ t: "a".repeat(MAX_CHECKLIST_TEXT + 50), done: false }]);
  assert.equal(out?.[0].t.length, MAX_CHECKLIST_TEXT);
});
