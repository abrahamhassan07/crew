import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildStaffMap, enrichJob, todayISO } from "@/lib/design";
import { ClientProfileClient } from "@/components/ClientProfileClient";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: properties }, { data: notes }, { data: staffList }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("properties").select("*").eq("client_id", id).order("created_at"),
    supabase.from("client_notes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("staff").select("*"),
    supabase.from("jobs").select("*").eq("client_id", id),
  ]);

  if (!client) notFound();

  const staffNameById = new Map((staffList ?? []).map((s) => [s.id, s.name]));
  const notesWithStaffName = (notes ?? []).map((n) => ({
    ...n,
    staffName: n.staff_id ? (staffNameById.get(n.staff_id) ?? null) : null,
  }));

  const staffById = buildStaffMap(staffList ?? []);
  const enrichedJobs = (jobs ?? []).map((j) => enrichJob(j, staffById));
  const today = todayISO();

  return <ClientProfileClient client={client} properties={properties ?? []} notes={notesWithStaffName} jobs={enrichedJobs} today={today} />;
}
