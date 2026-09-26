"use client";

import { Briefcase } from "lucide-react";
import { useJobModal } from "@/components/JobModalContext";

export function NewJobQuickAction() {
  const { openNewJob } = useJobModal();
  return (
    <button
      onClick={() => openNewJob()}
      className="p-3 rounded-lg border border-line hover:border-brand hover:bg-ok-tint transition-all text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-ok-bg text-ok-fg flex items-center justify-center mb-2">
        <Briefcase className="w-4 h-4" />
      </div>
      <span className="text-sm font-semibold text-ink-primary block">New job</span>
    </button>
  );
}
