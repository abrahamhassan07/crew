"use client";

import { useJobModal } from "@/components/JobModalContext";
import type { EnrichedJob } from "@/lib/design";

export function JobBlock({ job }: { job: EnrichedJob }) {
  const { openJob } = useJobModal();
  const cancelled = job.status === "cancelled";

  return (
    <div
      onClick={() => openJob(job.id)}
      className="rounded-lg px-2.5 py-2 mb-2 cursor-pointer"
      style={{
        background: job.typeTintHex,
        borderLeft: `4px solid ${job.staffColorHex}`,
        opacity: cancelled ? 0.55 : 1,
        textDecoration: cancelled ? "line-through" : "none",
      }}
    >
      <div className="text-xs font-bold">{job.timeLabel}</div>
      <div className="text-[13px] font-semibold leading-tight">{job.client_name}</div>
      <div className="text-[11px] text-ink-faint">
        {job.staffName} &middot; {job.typeLabel}
      </div>
    </div>
  );
}
