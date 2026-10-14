import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { QuoteEditor } from "@/components/QuoteEditor";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
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

  return <QuoteEditor quote={quote} items={items ?? []} clients={clients ?? []} properties={properties ?? []} services={services ?? []} gstRegistered={org?.gst_registered ?? true} notice={noticeText ? { text: noticeText, tone: sp.tone === "error" ? "error" : "ok" } : null} />;
}
