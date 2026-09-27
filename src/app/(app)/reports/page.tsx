import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ReportsPageClient } from "@/components/ReportsPageClient";

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: clients },
    { data: staffList },
    { data: crews },
    { data: services },
    { data: jobs },
    { data: requests },
    { data: quotes },
    { data: invoices },
    { data: invoiceItems },
    { data: payments },
  ] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("staff").select("*"),
    supabase.from("crews").select("*").order("name"),
    supabase.from("services").select("*"),
    supabase.from("jobs").select("*"),
    supabase.from("requests").select("*"),
    supabase.from("quotes").select("id, request_id, status"),
    supabase.from("invoices").select("*"),
    supabase.from("invoice_items").select("invoice_id, qty, unit_price"),
    supabase.from("payments").select("invoice_id, amount, paid_date"),
  ]);

  return (
    <ReportsPageClient
      clients={clients ?? []}
      staffList={staffList ?? []}
      crews={crews ?? []}
      services={services ?? []}
      jobs={jobs ?? []}
      requests={requests ?? []}
      quotes={quotes ?? []}
      invoices={invoices ?? []}
      invoiceItems={invoiceItems ?? []}
      payments={payments ?? []}
    />
  );
}
