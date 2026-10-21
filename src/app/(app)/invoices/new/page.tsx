import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fmtDateLabel } from "@/lib/design";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { suggestInvoiceNum, type InvoiceLineInput } from "@/app/(app)/actions";
import { getConnection, orgMayUseXero } from "@/lib/xero";

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const fromJobId = typeof params.job === "string" ? params.job : null;

  const [{ data: clients }, { data: properties }, { data: services }, { data: jobs }, { data: organization }, { data: fromJob }] = await Promise.all([
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
    supabase.from("jobs").select("id, num, title, job_type, client_id, job_date"),
    supabase.from("organizations").select("*").eq("id", viewer.orgId).single(),
    fromJobId ? supabase.from("jobs").select("*").eq("id", fromJobId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Started from a completed job: carry its client, address and work over as the first line item.
  let prefill: { clientId: string; propertyId: string; jobId: string; lines: InvoiceLineInput[] } | undefined;
  if (fromJob) {
    const service = fromJob.service_id ? (services ?? []).find((s) => s.id === fromJob.service_id) : undefined;
    const name = fromJob.title || service?.name || `${fromJob.job_type.charAt(0).toUpperCase()}${fromJob.job_type.slice(1)} service`;
    const description = [fromJob.job_date ? fmtDateLabel(fromJob.job_date) : "", fromJob.address].filter(Boolean).join(" · ");
    prefill = {
      clientId: fromJob.client_id ?? "",
      propertyId: fromJob.property_id ?? "",
      jobId: fromJob.id,
      lines: [{ serviceId: fromJob.service_id, serviceName: name, description, qty: 1, unitPrice: fromJob.price ?? service?.price ?? 0 }],
    };
  }

  const suggestedNum = await suggestInvoiceNum();
  const xeroConnected = !!(await getConnection(viewer.orgId)) && (await orgMayUseXero(viewer.orgId));

  return (
    <InvoiceEditor
      invoice={null}
      suggestedNum={suggestedNum}
      xeroConnected={xeroConnected}
      items={[]}
      payments={[]}
      clients={clients ?? []}
      properties={properties ?? []}
      services={services ?? []}
      jobs={jobs ?? []}
      organization={organization ?? null}
      prefill={prefill}
    />
  );
}
