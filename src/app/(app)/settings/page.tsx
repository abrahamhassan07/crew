import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { SettingsPageClient } from "@/components/SettingsPageClient";

export default async function SettingsPage() {
  const viewer = await requireAdmin();
  const supabase = await createClient();

  const { data: organization } = await supabase.from("organizations").select("*").eq("id", viewer.orgId).single();

  if (!organization) return null;

  return <SettingsPageClient organization={organization} />;
}
