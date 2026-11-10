import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { redirect } from "next/navigation";
import { staffDraftContext, staffDraftData } from "@/lib/staffDrafts";
import { aiAllowed } from "@/lib/billing";
import { QuoteEditor } from "@/components/QuoteEditor";

export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") {
    const ctx = await staffDraftContext();
    if (!ctx.ok) redirect("/dashboard");
    const d = await staffDraftData(viewer.orgId, ctx.staffId);
    return <QuoteEditor quote={null} items={[]} clients={d.clients} properties={d.properties} services={d.services} gstRegistered={ctx.org.gst_registered} staffMode voiceEnabled={ctx.org.ai_voice_quote_enabled} />;
  }
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: properties }, { data: services }, { data: org }] = await Promise.all([
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("properties").select("*"),
    supabase.from("services").select("*").eq("active", true).order("name"),
    supabase.from("organizations").select("*").eq("id", viewer.orgId).single(),
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
      voiceEnabled={aiAllowed(org) && !!org?.ai_voice_quote_enabled}
    />
  );
}
