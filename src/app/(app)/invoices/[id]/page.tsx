import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { InvoiceEditor } from "@/components/InvoiceEditor";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: invoice }, { data: items }, { data: payments }, { data: clients }, { data: properties }, { data: services }, { data: jobs }, { data: organization }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("payments").select("*").eq("invoice_id", id).order("paid_date"),
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
    supabase.from("jobs").select("id, num, title, job_type, client_id, job_date"),
    supabase.from("organizations").select("*").eq("id", viewer.orgId).single(),
  ]);

  if (!invoice) notFound();

  return (
    <InvoiceEditor
      invoice={invoice}
      items={items ?? []}
      payments={payments ?? []}
      clients={clients ?? []}
      properties={properties ?? []}
      services={services ?? []}
      jobs={jobs ?? []}
      organization={organization ?? null}
      startInEdit={sp.edit === "1"}
    />
  );
}
