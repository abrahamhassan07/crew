import type { GstMode } from "@/lib/supabase/types";

export interface LineLike {
  qty: number;
  unit_price: number;
}

export function calcTotals(items: LineLike[], mode: GstMode): { sub: number; gst: number; total: number } {
  const line = round2(items.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0));
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
