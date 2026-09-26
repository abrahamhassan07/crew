import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ClientForm } from "@/components/ClientForm";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: properties }, { data: contacts }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("properties").select("*").eq("client_id", id).order("created_at"),
    supabase.from("client_contacts").select("*").eq("client_id", id).order("created_at"),
  ]);

  if (!client) notFound();

  return <ClientForm mode="edit" client={client} properties={properties ?? []} contacts={contacts ?? []} />;
}
