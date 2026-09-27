"use client";

import type { EnrichedJob } from "@/lib/design";
import type { Crew } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface CrewViewProps {
  crews: Crew[];
  jobsByCrew: Map<string, EnrichedJob[]>;
  unassignedJobs: EnrichedJob[];
  onJobClick: (jobId: string) => void;
}

function statusBadgeStatus(status: EnrichedJob["status"]) {
  return status === "in_progress" ? "in-progress" : status;
}

function JobLine({ job, onJobClick }: { job: EnrichedJob; onJobClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onJobClick(job.id)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-page-bg transition-colors border-b border-line-soft last:border-b-0"
    >
      <span className="text-xs font-semibold text-ink-muted w-24 shrink-0">{job.dateLabel}, {job.timeLabel}</span>
      <span className="text-sm font-semibold text-ink-primary flex-1 min-w-0 truncate">{job.client_name}</span>
      <span className="text-xs text-ink-muted hidden sm:block flex-1 min-w-0 truncate">{job.address}</span>
      <StatusBadge status={statusBadgeStatus(job.status)} label={job.statusLabel} showDot />
    </button>
  );
}

export function CrewView({ crews, jobsByCrew, unassignedJobs, onJobClick }: CrewViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {crews.map((crew) => {
        const jobs = jobsByCrew.get(crew.id) ?? [];
        return (
          <div key={crew.id} className="bg-card-bg border border-line rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line" style={{ background: crew.tint_hex }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: crew.color_hex }} />
              <span className="font-bold text-sm text-ink-primary">{crew.name}</span>
              <span className="text-xs text-ink-muted">{jobs.length} job{jobs.length === 1 ? "" : "s"} this week</span>
            </div>
            {jobs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-ink-muted">No jobs scheduled for this crew.</div>
            ) : (
              jobs.map((job) => <JobLine key={job.id} job={job} onJobClick={onJobClick} />)
            )}
          </div>
        );
      })}

      {unassignedJobs.length > 0 && (
        <div className="bg-card-bg border border-line rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-warn-bg">
            <span className="w-2.5 h-2.5 rounded-full bg-warn-fg" />
            <span className="font-bold text-sm text-ink-primary">No crew assigned</span>
            <span className="text-xs text-ink-muted">{unassignedJobs.length} job{unassignedJobs.length === 1 ? "" : "s"} this week</span>
          </div>
          {unassignedJobs.map((job) => (
            <JobLine key={job.id} job={job} onJobClick={onJobClick} />
          ))}
        </div>
      )}
    </div>
  );
}
