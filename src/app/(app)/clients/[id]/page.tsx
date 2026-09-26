import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ClientProfileClient } from "@/components/ClientProfileClient";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: properties }, { data: notes }, { data: staffList }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("properties").select("*").eq("client_id", id).order("created_at"),
    supabase.from("client_notes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("staff").select("id, name"),
  ]);

  if (!client) notFound();

  const staffNameById = new Map((staffList ?? []).map((s) => [s.id, s.name]));
  const notesWithStaffName = (notes ?? []).map((n) => ({
    ...n,
    staffName: n.staff_id ? (staffNameById.get(n.staff_id) ?? null) : null,
  }));

  return <ClientProfileClient client={client} properties={properties ?? []} notes={notesWithStaffName} />;
}
