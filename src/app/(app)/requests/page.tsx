import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { RequestsPageClient } from "@/components/RequestsPageClient";

export default async function RequestsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: requests }, { data: clients }, { data: services }] = await Promise.all([
    supabase.from("requests").select("*").order("received_at", { ascending: false }),
    supabase.from("clients").select("*").neq("status", "Archived").order("name"),
    supabase.from("services").select("*").eq("active", true).order("name"),
  ]);

  return <RequestsPageClient requests={requests ?? []} clients={clients ?? []} services={services ?? []} />;
}
