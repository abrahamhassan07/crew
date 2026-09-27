import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { InvoiceEditor } from "@/components/InvoiceEditor";

export default async function NewInvoicePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: clients }, { data: properties }, { data: services }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
    supabase.from("jobs").select("id, num, title, job_type, client_id, job_date"),
  ]);

  return <InvoiceEditor invoice={null} items={[]} payments={[]} clients={clients ?? []} properties={properties ?? []} services={services ?? []} jobs={jobs ?? []} />;
}
