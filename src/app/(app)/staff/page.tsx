import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/design";
import { StaffPageClient } from "@/components/StaffPageClient";

export default async function StaffPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: staffList }, { data: jobs }] = await Promise.all([
    supabase.from("staff").select("*").order("name"),
    supabase.from("jobs").select("id, assigned_staff_id, job_date, status"),
  ]);

  const today = todayISO();
  const withCounts = (staffList ?? []).map((s) => ({
    ...s,
    upcomingCount: (jobs ?? []).filter((j) => j.assigned_staff_id === s.id && j.job_date >= today && j.status !== "cancelled").length,
  }));

  return <StaffPageClient staffList={withCounts} />;
}
