import { createClient } from "@/lib/supabase/server";
import { daysFromToday } from "@/lib/design";
import { requireAdmin } from "@/lib/auth";
import { InvoicesPageClient } from "@/components/InvoicesPageClient";

const TABS = ["All", "Outstanding", "Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Voided"] as const;

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const params = await searchParams;
  const initialTab = TABS.find((t) => t === params.tab) ?? "All";
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: invoices }, { data: clients }, { data: items }, { data: payments }, { data: jobs }] = await Promise.all([
    supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
    supabase.from("clients").select("*"),
    supabase.from("invoice_items").select("invoice_id, qty, unit_price"),
    supabase.from("payments").select("invoice_id, amount, paid_date"),
    supabase.from("jobs").select("id, num"),
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

  const thirtyDaysAgo = daysFromToday(-30);
  const paidPast30 = (payments ?? []).filter((p) => p.paid_date >= thirtyDaysAgo).reduce((s, p) => s + p.amount, 0);

  const jobNumById = new Map((jobs ?? []).map((j) => [j.id, j.num]));

  return (
    <InvoicesPageClient
      invoices={invoices ?? []}
      clients={clients ?? []}
      itemsByInvoice={itemsByInvoice}
      paidByInvoice={paidByInvoice}
      jobNumById={Object.fromEntries(jobNumById)}
      paidPast30={paidPast30}
      initialTab={initialTab}
    />
  );
}
