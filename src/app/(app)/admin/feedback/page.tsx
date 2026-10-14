import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform";
import { AdminFeedbackClient } from "@/components/AdminFeedbackClient";

export default async function AdminFeedbackPage() {
  const viewer = await getViewer();
  if (!isPlatformAdmin(viewer.email)) notFound();

  const db = createAdminClient();
  const [{ data: items }, { data: orgs }] = await Promise.all([
    db.from("feedback").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("organizations").select("id, name"),
  ]);
  const orgNames: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));

  return <AdminFeedbackClient items={items ?? []} orgNames={orgNames} />;
}
