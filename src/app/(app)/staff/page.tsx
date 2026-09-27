import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { addDays, fmtISO, todayISO } from "@/lib/design";
import { StaffPageClient } from "@/components/StaffPageClient";

export default async function StaffPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: staffList }, { data: jobs }, { data: crews }] = await Promise.all([
    supabase.from("staff").select("*").order("name"),
    supabase.from("jobs").select("id, assigned_staff_id, crew_id, job_date, status"),
    supabase.from("crews").select("*").order("name"),
  ]);

  const today = todayISO();
  const weekEnd = fmtISO(addDays(new Date(), 6));

  const withCounts = (staffList ?? []).map((s) => ({
    ...s,
    upcomingCount: (jobs ?? []).filter(
      (j) => j.assigned_staff_id === s.id && j.job_date && j.job_date >= today && j.job_date <= weekEnd && j.status !== "cancelled"
    ).length,
  }));

  const crewsWithStats = (crews ?? []).map((c) => ({
    ...c,
    jobsToday: (jobs ?? []).filter((j) => j.crew_id === c.id && j.job_date === today && j.status !== "cancelled").length,
    jobsThisWeek: (jobs ?? []).filter((j) => j.crew_id === c.id && j.job_date && j.job_date >= today && j.job_date <= weekEnd && j.status !== "cancelled").length,
  }));

  return <StaffPageClient staffList={withCounts} crews={crewsWithStats} />;
}
