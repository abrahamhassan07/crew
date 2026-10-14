import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { QuoteEditor } from "@/components/QuoteEditor";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const noticeText = typeof sp.notice === "string" ? sp.notice : null;
  const supabase = await createClient();

  const [{ data: quote }, { data: items }, { data: clients }, { data: properties }, { data: services }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order"),
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
  ]);

  if (!quote) notFound();

  return <QuoteEditor quote={quote} items={items ?? []} clients={clients ?? []} properties={properties ?? []} services={services ?? []} notice={noticeText ? { text: noticeText, tone: sp.tone === "error" ? "error" : "ok" } : null} />;
}
