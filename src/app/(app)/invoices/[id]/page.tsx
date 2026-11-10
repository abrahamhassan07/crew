import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { nameForUser, publicOrg, staffDraftContext, staffDraftData } from "@/lib/staffDrafts";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { getConnection, orgMayUseXero } from "@/lib/xero";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (viewer.profile.role !== "admin") {
    // Staff see only their own drafts.
    const ctx = await staffDraftContext();
    if (!ctx.ok) notFound();
    const admin = createAdminClient();
    const { data: own } = await admin.from("invoices").select("*").eq("id", id).eq("org_id", viewer.orgId).eq("created_by", viewer.userId).maybeSingle();
    if (!own) notFound();
    const [{ data: ownItems }, d] = await Promise.all([admin.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"), staffDraftData(viewer.orgId, ctx.staffId)]);
    return <InvoiceEditor invoice={own} items={ownItems ?? []} payments={[]} clients={d.clients} properties={d.properties} services={d.services} jobs={d.jobs} organization={publicOrg(ctx.org)} staffMode startInEdit />;
  }
  const sp = await searchParams;
  const supabase = await createClient();
  const xeroConnected = !!(await getConnection(viewer.orgId)) && (await orgMayUseXero(viewer.orgId));

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
  const approval = invoice.created_by || invoice.approval_status || invoice.ai_generated
    ? { status: invoice.approval_status, drafter: invoice.created_by && invoice.created_by !== viewer.userId ? await nameForUser(viewer.orgId, invoice.created_by) : null, approver: await nameForUser(viewer.orgId, invoice.approved_by), approvedAt: invoice.approved_at, aiGenerated: invoice.ai_generated }
    : null;

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
      xeroConnected={xeroConnected}
      approval={approval}
    />
  );
}
