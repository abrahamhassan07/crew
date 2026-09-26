import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildStaffMap, enrichJob } from "@/lib/design";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Plus, MapPin, Clock } from "lucide-react";
import type { Column } from "@/components/ui/DataTable";
import type { EnrichedJob } from "@/lib/design";

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

  const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const typeOptions = [
    { value: "cleaning", label: "Cleaning" },
    { value: "gardening", label: "Gardening" },
    { value: "both", label: "Both" },
  ];

  const columns: Column<EnrichedJob>[] = [
    {
      key: "job_date",
      label: "Date",
      sortable: true,
      render: (date: string) => (
        <div className="font-semibold">
          {new Date(date + "T00:00:00").toLocaleDateString("en-AU", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      ),
    },
    {
      key: "start_time",
      label: "Time",
      sortable: false,
      render: (time: string) => (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-ink-muted" />
          {time}
        </div>
      ),
    },
    {
      key: "client_name",
      label: "Client",
      sortable: true,
    },
    {
      key: "address",
      label: "Address",
      sortable: false,
      render: (address: string) => (
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{address || "—"}</span>
        </div>
      ),
    },
    {
      key: "staffName",
      label: "Crew",
      sortable: false,
      render: (name: string, row: EnrichedJob) => (
        <div className="flex items-center gap-2">
          {row.assigned_staff_id && row.staffColorHex && (
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: row.staffColorHex }}
            />
          )}
          <span>{name || "Unassigned"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (status: string) => (
        <StatusBadge
          status={
            status === "in_progress"
              ? "in-progress"
              : status === "completed"
                ? "completed"
                : status === "cancelled"
                  ? "cancelled"
                  : "scheduled"
          }
          label={
            status === "in_progress"
              ? "In Progress"
              : status === "completed"
                ? "Completed"
                : status === "cancelled"
                  ? "Cancelled"
                  : "Scheduled"
          }
          showDot
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Page header */}
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-primary">Jobs</h1>
            <p className="text-sm text-ink-secondary mt-1">
              Manage and schedule jobs across your teams.
            </p>
          </div>
          <Link href="/jobs/new">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New job
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Filters summary */}
          <div className="mb-6 text-sm text-ink-muted">
            Showing {filtered.length} job{filtered.length !== 1 ? "s" : ""}
            {(status || staffId || type || from || to || search) && " (filtered)"}
          </div>

          {/* Table */}
          <DataTable columns={columns} data={filtered} />

          {filtered.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              {search || status || staffId || type || from || to
                ? "No jobs match your filters."
                : "No jobs scheduled."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
