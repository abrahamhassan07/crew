"use client";

import { useRouter } from "next/navigation";
import { Plus, MapPin, Clock } from "lucide-react";
import { useJobModal } from "@/components/JobModalContext";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Column } from "@/components/ui/DataTable";
import type { EnrichedJob } from "@/lib/design";

export function JobsPageClient({ jobs, filtered }: { jobs: EnrichedJob[]; filtered: boolean }) {
  const router = useRouter();
  const { openNewJob } = useJobModal();

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
          <Button variant="primary" size="md" onClick={() => openNewJob()}>
            <Plus className="w-4 h-4" />
            New job
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Filters summary */}
          <div className="mb-6 text-sm text-ink-muted">
            Showing {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            {filtered && " (filtered)"}
          </div>

          {/* Table */}
          <DataTable columns={columns} data={jobs} onRowClick={(job) => router.push(`/jobs/${job.id}`)} />

          {jobs.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              {filtered ? "No jobs match your filters." : "No jobs scheduled."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
