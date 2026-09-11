import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildStaffMap, enrichJob } from "@/lib/design";
import { JobRow } from "@/components/JobRow";
import { JobsFilterBar } from "@/components/JobsFilterBar";

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: jobs }, { data: staffList }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase.from("staff").select("*").order("name"),
  ]);

  const staffById = buildStaffMap(staffList ?? []);
  let filtered = (jobs ?? []).map((j) => enrichJob(j, staffById));

  const status = typeof params.status === "string" ? params.status : undefined;
  const staffId = typeof params.staffId === "string" ? params.staffId : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const search = typeof params.search === "string" ? params.search.toLowerCase() : undefined;

  if (status) filtered = filtered.filter((j) => j.status === status);
  if (staffId) filtered = filtered.filter((j) => (staffId === "unassigned" ? !j.assigned_staff_id : j.assigned_staff_id === staffId));
  if (type) filtered = filtered.filter((j) => j.job_type === type);
  if (from) filtered = filtered.filter((j) => j.job_date >= from);
  if (to) filtered = filtered.filter((j) => j.job_date <= to);
  if (search) filtered = filtered.filter((j) => j.client_name.toLowerCase().includes(search) || j.address.toLowerCase().includes(search));

  filtered.sort((a, b) => (a.job_date === b.job_date ? a.start_time.localeCompare(b.start_time) : a.job_date.localeCompare(b.job_date)));

  const staffOptions = (staffList ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <JobsFilterBar staffOptions={staffOptions} />
      <div className="text-[13px] text-ink-faint mb-3">{filtered.length} jobs</div>
      {filtered.length > 0 ? (
        filtered.map((job) => <JobRow key={job.id} job={job} showPrice showTime={false} />)
      ) : (
        <div className="text-sm text-ink-faint py-5">No jobs match your filters.</div>
      )}
    </div>
  );
}
