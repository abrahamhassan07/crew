import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { EquipmentPageClient } from "@/components/EquipmentPageClient";

export default async function EquipmentPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: equipment }, { data: crews }] = await Promise.all([
    supabase.from("equipment").select("*").order("name"),
    supabase.from("crews").select("*").order("name"),
  ]);

  return <EquipmentPageClient equipment={equipment ?? []} crews={crews ?? []} />;
}
