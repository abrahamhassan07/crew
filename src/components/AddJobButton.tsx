"use client";

import { useJobModal } from "@/components/JobModalContext";

export function AddJobButton({ date }: { date: string }) {
  const { openNewJob } = useJobModal();
  return (
    <div
      onClick={() => openNewJob(date)}
      className="text-center text-xs font-semibold text-ink-faint py-2 cursor-pointer border border-dashed border-border rounded-lg"
    >
      + Add job
    </div>
  );
}
