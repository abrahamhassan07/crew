import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildStaffMap, enrichJob } from "@/lib/design";
import { JobsPageClient } from "@/components/JobsPageClient";

export default async function JobsPage() {
  const viewer = await requireAdmin();
  const supabase = await createClient();

  const [{ data: jobs }, { data: staffList }, { data: crews }, { data: services }, { data: org }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase.from("staff").select("*").order("name"),
    supabase.from("crews").select("*").order("name"),
    supabase.from("services").select("*"),
    supabase.from("organizations").select("gst_registered").eq("id", viewer.orgId).single(),
  ]);

  const staffById = buildStaffMap(staffList ?? []);
  const enriched = (jobs ?? []).map((j) => enrichJob(j, staffById));

  return <JobsPageClient jobs={enriched} crews={crews ?? []} services={services ?? []} gstRegistered={org?.gst_registered ?? true} />;
}
