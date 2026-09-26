import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { QuotesPageClient } from "@/components/QuotesPageClient";
import type { GstMode } from "@/lib/supabase/types";

export default async function QuotesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: quotes }, { data: clients }, { data: items }] = await Promise.all([
    supabase.from("quotes").select("*").order("quote_date", { ascending: false }),
    supabase.from("clients").select("*"),
    supabase.from("quote_items").select("quote_id, qty, unit_price"),
  ]);

  const quoteMode = new Map((quotes ?? []).map((q) => [q.id, q.mode]));
  const itemTotals = new Map<string, { qty: number; unit_price: number; mode: GstMode }[]>();
  for (const item of items ?? []) {
    const mode = quoteMode.get(item.quote_id) ?? "exclusive";
    const arr = itemTotals.get(item.quote_id) ?? [];
    arr.push({ qty: item.qty, unit_price: item.unit_price, mode });
    itemTotals.set(item.quote_id, arr);
  }

  return <QuotesPageClient quotes={quotes ?? []} clients={clients ?? []} itemTotals={itemTotals} />;
}
