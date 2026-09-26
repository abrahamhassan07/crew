import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/design";
import { StaffProfileClient } from "@/components/StaffProfileClient";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: staff }, { data: crews }, { data: jobs }] = await Promise.all([
    supabase.from("staff").select("*").eq("id", id).single(),
    supabase.from("crews").select("*").order("name"),
    supabase
      .from("jobs")
      .select("id, client_name, address, job_date, start_time, status")
      .eq("assigned_staff_id", id)
      .gte("job_date", todayISO())
      .neq("status", "cancelled")
      .order("job_date")
      .order("start_time")
      .limit(10),
  ]);

  if (!staff) notFound();

  return <StaffProfileClient staff={staff} crews={crews ?? []} assignedJobs={jobs ?? []} />;
}
