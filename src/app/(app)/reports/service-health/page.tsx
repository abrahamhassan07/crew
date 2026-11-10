import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { aiAllowed } from "@/lib/billing";
import { ServiceHealthClient } from "@/components/ServiceHealthClient";

export default async function ServiceHealthPage({ searchParams }: { searchParams: Promise<{ audit?: string }> }) {
  await requireAdmin();
  const { audit: auditId } = await searchParams;
  const supabase = await createClient();
  const [{ data: org }, { data: audits }] = await Promise.all([
    supabase.from("organizations").select("*").single(),
    supabase.from("service_audits").select("*").order("created_at", { ascending: false }).limit(52),
  ]);
  const selected = (audits ?? []).find((a) => a.id === auditId) ?? (audits ?? [])[0] ?? null;
  const { data: items } = selected ? await supabase.from("service_audit_items").select("*").eq("audit_id", selected.id) : { data: [] };
  return <ServiceHealthClient audits={audits ?? []} selected={selected} items={items ?? []} planAllowed={aiAllowed(org)} enabled={!!org?.ai_auditor_enabled} />;
}
