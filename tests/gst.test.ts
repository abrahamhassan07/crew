import { test } from "node:test";
import assert from "node:assert/strict";
import { calcTotals, lineAmount, lineCents } from "../src/lib/gst.ts";

const l = (qty: number, unit_price: number) => ({ qty, unit_price });

test("per line (new documents): each line's amount and GST rounded to the cent, then added - like Xero and PH Accounts", () => {
  assert.deepEqual(calcTotals([l(1, 85)], "exclusive"), { sub: 85, gst: 8.5, total: 93.5 });
  // 3 x (33.33 + 3.33) = 109.98 (the old whole-invoice rule gives 109.99).
  assert.deepEqual(calcTotals([l(1, 33.33), l(1, 33.33), l(1, 33.33)], "exclusive"), { sub: 99.99, gst: 9.99, total: 109.98 });
  // 1.5 x 62.50 = 93.75, GST 9.375 -> 9.38; 3 x 12.05 = 36.15, GST 3.615 -> 3.62.
  assert.deepEqual(calcTotals([l(1.5, 62.5), l(3, 12.05)], "exclusive"), { sub: 129.9, gst: 13, total: 142.9 });
  assert.deepEqual(calcTotals([l(1, 99), l(2, 27.5)], "inclusive"), { sub: 140, gst: 14, total: 154 });
  // 10.01 / 11 = 0.91 per line.
  assert.deepEqual(calcTotals([l(1, 10.01), l(1, 10.01), l(1, 10.01)], "inclusive"), { sub: 27.3, gst: 2.73, total: 30.03 });
  assert.deepEqual(calcTotals([l(2, 45)], "none"), { sub: 90, gst: 0, total: 90 });
});

test("half cents round up exactly, with no floating-point slips", () => {
  // In floating point 1.15 * 0.1 is 0.11499999..., which naive rounding turns into 0.11.
  assert.equal(calcTotals([l(1, 1.15)], "exclusive").gst, 0.12);
  assert.equal(lineAmount(l(1, 1.005)), 1.01);
  assert.equal(lineAmount(l(3, 0.335)), 1.01); // 1.005
  assert.equal(lineCents(l(1.5, 33.333)), BigInt(5000)); // 49.9995 -> 50.00
  assert.equal(calcTotals([l(1, 0.05)], "exclusive").gst, 0.01); // 0.005 -> 0.01
});

test("older documents keep the original whole-invoice rule, so sent totals never change", () => {
  assert.deepEqual(calcTotals([l(1, 33.33), l(1, 33.33), l(1, 33.33)], "exclusive", "invoice"), { sub: 99.99, gst: 10, total: 109.99 });
  assert.deepEqual(calcTotals([l(1.5, 62.5), l(3, 12.05)], "exclusive", "invoice").total, 142.89);
});

test("empty and blank lines are zero", () => {
  assert.deepEqual(calcTotals([], "exclusive"), { sub: 0, gst: 0, total: 0 });
  assert.deepEqual(calcTotals([l(Number.NaN, 10)], "exclusive"), { sub: 0, gst: 0, total: 0 });
});
