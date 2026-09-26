import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildStaffMap, enrichJob } from "@/lib/design";
import { JobDetailClient } from "@/components/JobDetailClient";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: job }, { data: staffList }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).single(),
    supabase.from("staff").select("*"),
  ]);

  if (!job) notFound();

  const staffById = buildStaffMap(staffList ?? []);
  return <JobDetailClient job={enrichJob(job, staffById)} />;
}
