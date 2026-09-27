"use client";

import { useState, useTransition } from "react";
import { updateJobStatus } from "@/app/(app)/actions";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { durationLabel, fmtDateLabel, fmtTime12, STATUS_META, TYPE_META } from "@/lib/design";
import type { Job, JobStatus } from "@/lib/supabase/types";

export function StaffJobDrawer({
  job,
  onClose,
  onSaved,
}: {
  job: Job;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statusMeta = STATUS_META[job.status];
  const typeMeta = TYPE_META[job.job_type];

  const setStatus = (status: JobStatus, message: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateJobStatus(job.id, status);
      if (!result.ok) {
        setError(result.error ?? "Could not update status.");
        return;
      }
      onSaved(message);
    });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-card-bg shadow-2xl overflow-y-auto p-6 z-101 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="font-bold text-lg">{job.client_name}</div>
          <Badge label={statusMeta.label} color={statusMeta.hex} tint={statusMeta.tint} />
        </div>

        <div className="text-sm text-ink-muted">{job.address}</div>

        <div className="flex flex-wrap gap-2">
          <Badge label={typeMeta.label} color={typeMeta.hex} tint={typeMeta.tint} />
        </div>

        <dl className="grid grid-cols-2 gap-y-3 text-sm border-t border-line pt-4">
          <dt className="text-ink-muted">Date</dt>
          <dd className="font-medium">{fmtDateLabel(job.job_date)}</dd>
          <dt className="text-ink-muted">Time</dt>
          <dd className="font-medium">{job.start_time ? fmtTime12(job.start_time.slice(0, 5)) : "—"}</dd>
          <dt className="text-ink-muted">Duration</dt>
          <dd className="font-medium">{durationLabel(job.duration_minutes)}</dd>
        </dl>

        {job.notes && (
          <div className="border-t border-line pt-4">
            <div className="text-sm font-semibold mb-1">Notes</div>
            <p className="text-sm text-ink-muted whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5 mt-auto pt-4 border-t border-line">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <div className="flex-1" />
          {job.status === "scheduled" && (
            <>
              <button
                onClick={() => setStatus("cancelled", "Job cancelled")}
                disabled={pending}
                className="px-4 py-2.5 rounded-md border text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: "var(--bad-fg)", background: "var(--bad-bg)", color: "var(--bad-fg)" }}
              >
                Cancel job
              </button>
              <Button variant="primary" onClick={() => setStatus("in_progress", "Job started")} disabled={pending}>
                Start job
              </Button>
            </>
          )}
          {job.status === "in_progress" && (
            <Button variant="primary" onClick={() => setStatus("completed", "Job marked complete")} disabled={pending}>
              Mark complete
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
