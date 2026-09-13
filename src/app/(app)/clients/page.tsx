import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ClientsPageClient } from "@/components/ClientsPageClient";

export default async function ClientsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: clients } = await supabase.from("clients").select("*").order("name");

  return <ClientsPageClient clients={clients ?? []} />;
}
