import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { InvoicesPageClient } from "@/components/InvoicesPageClient";

export default async function InvoicesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: invoices }, { data: clients }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
    supabase.from("clients").select("*"),
    supabase.from("invoice_items").select("invoice_id, qty, unit_price"),
    supabase.from("payments").select("invoice_id, amount"),
  ]);

  const itemsByInvoice = new Map<string, { qty: number; unit_price: number }[]>();
  for (const item of items ?? []) {
    const arr = itemsByInvoice.get(item.invoice_id) ?? [];
    arr.push({ qty: item.qty, unit_price: item.unit_price });
    itemsByInvoice.set(item.invoice_id, arr);
  }

  const paidByInvoice = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + p.amount);
  }

  return <InvoicesPageClient invoices={invoices ?? []} clients={clients ?? []} itemsByInvoice={itemsByInvoice} paidByInvoice={paidByInvoice} />;
}
