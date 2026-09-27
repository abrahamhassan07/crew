"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat2 } from "lucide-react";
import { useJobModal } from "@/components/JobModalContext";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { SearchInput } from "@/components/ui/SearchInput";
import type { EnrichedJob } from "@/lib/design";
import type { Crew, Service } from "@/lib/supabase/types";

type JobStatusFilter = "All" | "Unscheduled" | "Scheduled" | "In Progress" | "Completed" | "Cancelled";

const STATUS_TABS: JobStatusFilter[] = ["All", "Unscheduled", "Scheduled", "In Progress", "Completed", "Cancelled"];

const SORT_OPTIONS = [
  { value: "date-desc", label: "Date (latest first)" },
  { value: "date-asc", label: "Date (earliest first)" },
  { value: "num-desc", label: "Job number (newest first)" },
  { value: "price-desc", label: "Price (high to low)" },
];

function jobDisplayStatus(job: EnrichedJob): JobStatusFilter {
  if (!job.job_date && job.status === "scheduled") return "Unscheduled";
  if (job.status === "in_progress") return "In Progress";
  if (job.status === "completed") return "Completed";
  if (job.status === "cancelled") return "Cancelled";
  return "Scheduled";
}

export function JobsPageClient({ jobs, crews, services }: { jobs: EnrichedJob[]; crews: Crew[]; services: Service[] }) {
  const router = useRouter();
  const { openNewJob } = useJobModal();
  const [tab, setTab] = useState<JobStatusFilter>("All");
  const [crewFilter, setCrewFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("date-desc");
  const [query, setQuery] = useState("");

  const crewById = new Map(crews.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (tab !== "All" && jobDisplayStatus(j) !== tab) return false;
      if (crewFilter !== "all" && j.crew_id !== crewFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!(j.num.toLowerCase().includes(q) || j.client_name.toLowerCase().includes(q) || j.address.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [jobs, tab, crewFilter, query]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return (a.job_date ?? "9999-99-99").localeCompare(b.job_date ?? "9999-99-99") || (a.start_time ?? "").localeCompare(b.start_time ?? "");
        case "num-desc":
          return (parseInt(b.num.replace(/\D/g, ""), 10) || 0) - (parseInt(a.num.replace(/\D/g, ""), 10) || 0);
        case "price-desc":
          return (b.price ?? 0) - (a.price ?? 0);
        case "date-desc":
        default:
          return (b.job_date ?? "").localeCompare(a.job_date ?? "") || (b.start_time ?? "").localeCompare(a.start_time ?? "");
      }
    });
    return rows;
  }, [filtered, sort]);

  const columns: Column<EnrichedJob>[] = [
    {
      key: "num",
      label: "Job",
      render: (num: string, row: EnrichedJob) => (
        <div className="flex items-center gap-1.5 font-semibold">
          {num}
          {row.recurrence !== "none" && <Repeat2 className="w-3.5 h-3.5 text-ink-muted" />}
        </div>
      ),
    },
    {
      key: "client_name",
      label: "Client & property",
      render: (name: string, row: EnrichedJob) => (
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-ink-secondary truncate max-w-[220px]">{row.address}</div>
        </div>
      ),
    },
    {
      key: "service_id",
      label: "Service",
      render: (serviceId: string | null) => <span>{serviceId ? (serviceById.get(serviceId)?.name ?? "—") : "—"}</span>,
    },
    {
      key: "crew_id",
      label: "Crew",
      render: (crewId: string | null) => {
        const crew = crewId ? crewById.get(crewId) : undefined;
        return crew ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: crew.color_hex }} />
            {crew.name}
          </div>
        ) : (
          <span className="text-ink-muted">Unassigned</span>
        );
      },
    },
    {
      key: "job_date",
      label: "Date & time",
      render: (_: string | null, row: EnrichedJob) => (
        <div>
          <div className="font-medium">{row.job_date ? row.dateLabel : "Not scheduled"}</div>
          {row.timeLabel && <div className="text-xs text-ink-muted">{row.timeLabel}</div>}
        </div>
      ),
    },
    {
      key: "durationLabel",
      label: "Duration",
    },
    {
      key: "price",
      label: "Price (ex. GST)",
      render: (price: number | null) => <span className="font-semibold">{price != null ? `$${price.toFixed(2)}` : "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (_: string, row: EnrichedJob) => {
        const display = jobDisplayStatus(row);
        const statusKey =
          display === "Unscheduled" ? "unscheduled" : display === "In Progress" ? "in-progress" : (display.toLowerCase() as "scheduled" | "completed" | "cancelled");
        return <StatusBadge status={statusKey} label={display} showDot />;
      },
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Jobs"
        subtitle="Manage and schedule jobs across your teams."
        actions={
          <Button variant="primary" size="md" onClick={() => openNewJob()}>
            <Plus className="w-4 h-4" />
            New job
          </Button>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <FilterTabs
              options={STATUS_TABS.map((s) => ({ value: s, label: s, count: s === "All" ? jobs.length : jobs.filter((j) => jobDisplayStatus(j) === s).length }))}
              value={tab}
              onChange={setTab}
            />
            <div className="flex-1" />
            <select
              value={crewFilter}
              onChange={(e) => setCrewFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-field-border text-sm bg-card-bg text-ink-primary"
            >
              <option value="all">All crews</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 px-3 rounded-md border border-field-border text-sm bg-card-bg text-ink-primary"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <SearchInput value={query} onChange={setQuery} placeholder="Search jobs…" className="max-w-md" />
          </div>

          <div className="mb-4 text-sm text-ink-muted">
            Showing {sorted.length} job{sorted.length !== 1 ? "s" : ""}
          </div>

          <DataTable columns={columns} data={sorted} onRowClick={(job) => router.push(`/jobs/${job.id}`)} />

          {sorted.length === 0 && (
            <div className="text-center py-8 text-ink-muted">No jobs match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
