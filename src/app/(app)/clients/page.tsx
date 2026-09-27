import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ClientsPageClient } from "@/components/ClientsPageClient";

export default async function ClientsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: clients }, { data: jobs }, { data: quotes }, { data: invoices }, { data: notes }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("jobs").select("client_id, updated_at").not("client_id", "is", null),
    supabase.from("quotes").select("client_id, updated_at"),
    supabase.from("invoices").select("client_id, updated_at"),
    supabase.from("client_notes").select("client_id, created_at"),
  ]);

  const lastActivityByClient = new Map<string, string>();
  const bump = (clientId: string | null, iso: string) => {
    if (!clientId) return;
    const current = lastActivityByClient.get(clientId);
    if (!current || iso > current) lastActivityByClient.set(clientId, iso);
  };
  for (const c of clients ?? []) bump(c.id, c.updated_at);
  for (const j of jobs ?? []) bump(j.client_id, j.updated_at);
  for (const q of quotes ?? []) bump(q.client_id, q.updated_at);
  for (const i of invoices ?? []) bump(i.client_id, i.updated_at);
  for (const n of notes ?? []) bump(n.client_id, n.created_at);

  const now = new Date();
  const last30Start = new Date(now.getTime() - 30 * 864e5);
  const prior30Start = new Date(now.getTime() - 60 * 864e5);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const inRange = (iso: string, start: Date, end?: Date) => {
    const d = new Date(iso);
    return d >= start && (!end || d < end);
  };
  const pctDelta = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : null;

  const newLeads30 = (clients ?? []).filter((c) => c.status === "Lead" && inRange(c.created_at, last30Start)).length;
  const newLeadsPrior30 = (clients ?? []).filter((c) => c.status === "Lead" && inRange(c.created_at, prior30Start, last30Start)).length;
  const newClients30 = (clients ?? []).filter((c) => c.status === "Active" && inRange(c.created_at, last30Start)).length;
  const newClientsPrior30 = (clients ?? []).filter((c) => c.status === "Active" && inRange(c.created_at, prior30Start, last30Start)).length;
  const totalNewClientsYtd = (clients ?? []).filter((c) => inRange(c.created_at, yearStart)).length;

  const allTags = Array.from(new Set((clients ?? []).flatMap((c) => c.tags ?? []))).sort();

  const kpis = {
    newLeads30,
    newLeadsDelta: pctDelta(newLeads30, newLeadsPrior30),
    newClients30,
    newClientsDelta: pctDelta(newClients30, newClientsPrior30),
    totalNewClientsYtd,
  };

  return (
    <ClientsPageClient
      clients={clients ?? []}
      lastActivityByClient={Object.fromEntries(lastActivityByClient)}
      kpis={kpis}
      allTags={allTags}
    />
  );
}
