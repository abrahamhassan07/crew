import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ServicesPageClient } from "@/components/ServicesPageClient";

export default async function ServicesPage() {
  const viewer = await requireAdmin();
  const supabase = await createClient();

  const [{ data: services }, { data: crews }, { data: org }] = await Promise.all([
    supabase.from("services").select("*").order("name"),
    supabase.from("crews").select("*").order("name"),
    supabase.from("organizations").select("gst_registered").eq("id", viewer.orgId).single(),
  ]);

  return <ServicesPageClient services={services ?? []} crews={crews ?? []} gstRegistered={org?.gst_registered ?? true} />;
}
