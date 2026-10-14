import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { QuoteEditor } from "@/components/QuoteEditor";

export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: properties }, { data: services }, { data: org }] = await Promise.all([
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
    supabase.from("organizations").select("gst_registered").eq("id", viewer.orgId).single(),
  ]);

  const clientId = typeof params.clientId === "string" ? params.clientId : undefined;
  const requestId = typeof params.requestId === "string" ? params.requestId : undefined;

  return (
    <QuoteEditor
      quote={null}
      items={[]}
      clients={clients ?? []}
      properties={properties ?? []}
      services={services ?? []}
      initialClientId={clientId}
      initialRequestId={requestId}
      gstRegistered={org?.gst_registered ?? true}
    />
  );
}
