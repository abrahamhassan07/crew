"use client";

import { Badge, StaffDot } from "@/components/Badge";
import { useJobModal } from "@/components/JobModalContext";
import type { EnrichedJob } from "@/lib/design";

export function JobRow({
  job,
  showPrice,
  showTime,
  unassignedNotice,
}: {
  job: EnrichedJob;
  showPrice?: boolean;
  showTime?: boolean;
  unassignedNotice?: boolean;
}) {
  const { openJob } = useJobModal();
  const opacity = job.status === "cancelled" ? 0.55 : 1;

  return (
    <div
      onClick={() => openJob(job.id)}
      style={{ opacity }}
      className="bg-white border border-border rounded-xl px-4 py-3.5 mb-2.5 cursor-pointer flex flex-wrap items-center gap-4"
    >
      {showTime && <div className="min-w-[70px] font-semibold text-sm">{job.timeLabel}</div>}
      <div className="min-w-[150px] flex-[2]">
        <div className="font-semibold text-sm">{job.client_name}</div>
        <div className="text-xs text-ink-faint">{job.address}</div>
      </div>
      {!showTime && (
        <div className="text-sm text-ink-faint min-w-[120px]">
          {job.dateLabel}, {job.timeLabel}
        </div>
      )}
      <Badge label={job.typeLabel} color={job.typeColorHex} tint={job.typeTintHex} />
      {unassignedNotice ? (
        <div className="text-sm font-medium min-w-[110px]" style={{ color: "var(--color-danger)" }}>
          Unassigned
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm font-medium min-w-[110px]">
          <StaffDot colorHex={job.staffColorHex} />
          {job.staffName}
        </div>
      )}
      {!unassignedNotice && <Badge label={job.statusLabel} color={job.statusColorHex} tint={job.statusTintHex} />}
      {showPrice && <div className="text-sm font-semibold min-w-[56px] text-right ml-auto">{job.priceLabel}</div>}
    </div>
  );
}
