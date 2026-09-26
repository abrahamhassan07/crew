import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { QuoteEditor } from "@/components/QuoteEditor";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: items }, { data: clients }, { data: properties }, { data: services }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order"),
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
  ]);

  if (!quote) notFound();

  return <QuoteEditor quote={quote} items={items ?? []} clients={clients ?? []} properties={properties ?? []} services={services ?? []} />;
}
