import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildStaffMap, enrichJob } from "@/lib/design";
import { JobDetailClient } from "@/components/JobDetailClient";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: job }, { data: staffList }, { data: invoice }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).single(),
    supabase.from("staff").select("*"),
    supabase.from("invoices").select("id").eq("job_id", id).neq("status", "Voided").limit(1).maybeSingle(),
  ]);

  if (!job) notFound();

  const staffById = buildStaffMap(staffList ?? []);
  return <JobDetailClient job={enrichJob(job, staffById)} invoiceId={invoice?.id ?? null} />;
}
