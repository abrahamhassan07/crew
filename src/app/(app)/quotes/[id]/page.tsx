import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { nameForUser, staffDraftContext, staffDraftData } from "@/lib/staffDrafts";
import { QuoteEditor } from "@/components/QuoteEditor";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (viewer.profile.role !== "admin") {
    // Staff see only their own drafts.
    const ctx = await staffDraftContext();
    if (!ctx.ok) notFound();
    const admin = createAdminClient();
    const { data: own } = await admin.from("quotes").select("*").eq("id", id).eq("org_id", viewer.orgId).eq("created_by", viewer.userId).maybeSingle();
    if (!own) notFound();
    const [{ data: ownItems }, d] = await Promise.all([admin.from("quote_items").select("*").eq("quote_id", id).order("sort_order"), staffDraftData(viewer.orgId, ctx.staffId)]);
    return <QuoteEditor quote={own} items={ownItems ?? []} clients={d.clients} properties={d.properties} services={d.services} gstRegistered={ctx.org.gst_registered} staffMode />;
  }
  const sp = await searchParams;
  const noticeText = typeof sp.notice === "string" ? sp.notice : null;
  const supabase = await createClient();

  const [{ data: quote }, { data: items }, { data: clients }, { data: properties }, { data: services }, { data: org }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order"),
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
    supabase.from("organizations").select("gst_registered").eq("id", viewer.orgId).single(),
  ]);

  if (!quote) notFound();
  const approval = quote.created_by || quote.approval_status || quote.ai_generated
    ? { status: quote.approval_status, drafter: quote.created_by && quote.created_by !== viewer.userId ? await nameForUser(viewer.orgId, quote.created_by) : null, approver: await nameForUser(viewer.orgId, quote.approved_by), approvedAt: quote.approved_at, aiGenerated: quote.ai_generated }
    : null;

  return <QuoteEditor quote={quote} items={items ?? []} clients={clients ?? []} properties={properties ?? []} services={services ?? []} gstRegistered={org?.gst_registered ?? true} approval={approval} notice={noticeText ? { text: noticeText, tone: sp.tone === "error" ? "error" : "ok" } : null} />;
}
