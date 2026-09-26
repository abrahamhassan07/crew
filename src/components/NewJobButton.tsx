"use client";

import { Plus } from "lucide-react";
import { useJobModal } from "@/components/JobModalContext";
import { Button } from "@/components/ui/Button";

export function NewJobButton({ prefillDate }: { prefillDate?: string }) {
  const { openNewJob } = useJobModal();
  return (
    <Button variant="primary" size="md" onClick={() => openNewJob(prefillDate)}>
      <Plus className="w-4 h-4" />
      New job
    </Button>
  );
}
