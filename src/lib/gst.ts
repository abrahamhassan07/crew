import type { GstMode, GstRounding } from "@/lib/supabase/types";

export interface LineLike {
  qty: number;
  unit_price: number;
}

/**
 * Invoice / quote totals. `rounding` is stored on each document:
 * - "line" (every document created since 2026-11-23): each line's amount and its GST are rounded to cents, then
 *   added up - how Xero and PH Accounts work, so totals match them to the cent. Worked in exact whole numbers
 *   (no floating-point rounding errors at the half cent).
 * - "invoice" (documents created before that): GST worked out once on the total, the original rule. Kept so a
 *   document that was already sent never changes its total.
 */
export function calcTotals(items: LineLike[], mode: GstMode, rounding: GstRounding = "line"): { sub: number; gst: number; total: number } {
  if (rounding === "line") return calcTotalsPerLine(items, mode);
  const line = round2(items.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0));
  if (mode === "none") return { sub: line, gst: 0, total: line };
  if (mode === "inclusive") {
    const gst = round2(line / 11);
    return { sub: round2(line - gst), gst, total: line };
  }
  const gst = round2(line * 0.1);
  return { sub: line, gst, total: round2(line + gst) };
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------------------
// Exact per-line maths in integers (quantities and prices to 4 decimal places).
// ---------------------------------------------------------------------------

/** A number as an integer count of 1/10^dp units, from its decimal text (no float multiplication). */
function toUnits(value: number, dp: number): bigint {
  const n = Number.isFinite(value) ? value : 0;
  const [whole, frac = ""] = Math.abs(n).toFixed(dp).split(".");
  const units = BigInt(whole + frac.padEnd(dp, "0"));
  return n < 0 ? -units : units;
}

/** a / b rounded half away from zero (the same as ROUND_HALF_UP in decimal.js / PH Accounts). b > 0. */
function divRound(a: bigint, b: bigint): bigint {
  const negative = a < BigInt(0);
  const abs = negative ? -a : a;
  const q = (abs * BigInt(2) + b) / (BigInt(2) * b);
  return negative ? -q : q;
}

/** One line's amount in cents: qty x price, rounded to the cent. */
export function lineCents(item: LineLike): bigint {
  // qty (4 dp) x price (4 dp) = 8 dp units; cents are 2 dp, so divide by 10^6.
  return divRound(toUnits(item.qty || 0, 4) * toUnits(item.unit_price || 0, 4), BigInt(1_000_000));
}

/** 10% GST on one line, in cents: added on top (exclusive) or contained in the amount (inclusive, 1/11th). */
export function lineGstCents(amountCents: bigint, mode: GstMode): bigint {
  if (mode === "none") return BigInt(0);
  return mode === "inclusive" ? divRound(amountCents, BigInt(11)) : divRound(amountCents, BigInt(10));
}

function calcTotalsPerLine(items: LineLike[], mode: GstMode): { sub: number; gst: number; total: number } {
  let amount = BigInt(0);
  let gst = BigInt(0);
  for (const item of items) {
    const cents = lineCents(item);
    amount += cents;
    gst += lineGstCents(cents, mode);
  }
  const dollars = (c: bigint) => Number(c) / 100;
  if (mode === "inclusive") return { sub: dollars(amount - gst), gst: dollars(gst), total: dollars(amount) };
  return { sub: dollars(amount), gst: dollars(gst), total: dollars(amount + gst) };
}

/** One line's amount in dollars, rounded exactly to the cent (what's shown on screen and on the PDF). */
export function lineAmount(item: LineLike): number {
  return Number(lineCents(item)) / 100;
}
