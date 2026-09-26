import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ServicesPageClient } from "@/components/ServicesPageClient";

export default async function ServicesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: services }, { data: crews }] = await Promise.all([
    supabase.from("services").select("*").order("name"),
    supabase.from("crews").select("*").order("name"),
  ]);

  return <ServicesPageClient services={services ?? []} crews={crews ?? []} />;
}
