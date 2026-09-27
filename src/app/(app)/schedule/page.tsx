import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { buildStaffMap, enrichJob } from "@/lib/design";
import { ScheduleClient } from "@/components/schedule/ScheduleClient";

export default async function SchedulePage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  const [{ data: jobs }, { data: staffList }, { data: crews }, { data: requests }, { data: services }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase.from("staff").select("*"),
    supabase.from("crews").select("*").order("name"),
    supabase.from("requests").select("*").in("status", ["New", "Contacted", "Quoted"]).order("received_at", { ascending: false }),
    supabase.from("services").select("*"),
  ]);

  const staffById = buildStaffMap(staffList ?? []);
  const enriched = (jobs ?? []).map((j) => enrichJob(j, staffById));

  return (
    <ScheduleClient
      jobs={enriched}
      crews={crews ?? []}
      requests={requests ?? []}
      services={services ?? []}
      isAdmin={viewer.profile.role === "admin"}
    />
  );
}
