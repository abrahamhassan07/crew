import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform";
import { FeedbackPageClient } from "@/components/FeedbackPageClient";

export default async function FeedbackPage() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(50);

  return <FeedbackPageClient items={data ?? []} unavailable={!!error} isPlatformAdmin={isPlatformAdmin(viewer.email)} />;
}
