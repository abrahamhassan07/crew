"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Clock, DollarSign, HardHat, MapPin, Phone } from "lucide-react";
import { updateJobChecklist, updateJobNotes, updateJobStatus } from "@/app/(app)/actions";
import { useJobModal } from "@/components/JobModalContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { durationLabel, fmtDateLabel, fmtTime12 } from "@/lib/design";
import type { EnrichedJob } from "@/lib/design";
import type { JobStatus } from "@/lib/supabase/types";

const STATUS_STEPS: { value: JobStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function badgeStatus(status: JobStatus): "scheduled" | "in-progress" | "completed" | "cancelled" {
  return status === "in_progress" ? "in-progress" : status;
}

export function JobDetailClient({ job }: { job: EnrichedJob }) {
  const router = useRouter();
  const { openJob } = useJobModal();
  const [pending, startTransition] = useTransition();
  const [checklist, setChecklist] = useState(job.checklist ?? []);
  const [notes, setNotes] = useState(job.notes);

  const setStatus = (status: JobStatus) => {
    startTransition(async () => {
      await updateJobStatus(job.id, status);
      router.refresh();
    });
  };

  const toggleItem = (i: number) => {
    const next = checklist.map((c, k) => (k === i ? { ...c, done: !c.done } : c));
    setChecklist(next);
    startTransition(async () => {
      await updateJobChecklist(job.id, next);
    });
  };

  const saveNotes = () => {
    startTransition(async () => {
      const result = await updateJobNotes(job.id, notes);
      if (result.ok) router.refresh();
    });
  };

  const done = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? (done / checklist.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-5xl mx-auto">
          <Link href="/jobs" className="text-sm font-semibold text-brand mb-3 inline-block">
            ← Jobs
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={badgeStatus(job.status)} label={STATUS_STEPS.find((s) => s.value === job.status)?.label ?? job.status} showDot />
                {job.recurrence !== "none" && <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-bg text-ink-secondary capitalize">{job.recurrence}</span>}
              </div>
              <h1 className="text-2xl font-bold text-ink-primary mt-2">{job.title || `${job.job_type} job`}</h1>
              <div className="text-sm text-ink-secondary mt-1">{job.client_name}</div>
            </div>
            <Button variant="secondary" size="md" onClick={() => openJob(job.id)}>
              Edit job
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-[2] w-full flex flex-col gap-6">
            <Card className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Fact icon={MapPin} label="Address" value={job.address} />
              <Fact icon={Calendar} label="Date" value={fmtDateLabel(job.job_date)} />
              <Fact icon={Clock} label="Time" value={`${fmtTime12(job.start_time)} · ${durationLabel(job.duration_minutes)}`} />
              <Fact icon={HardHat} label="Assigned staff" value={job.staffName || "Unassigned"} />
              <Fact icon={DollarSign} label="Price" value={job.price != null ? `$${job.price.toFixed(2)}` : "—"} />
              {job.notes && <Fact icon={Phone} label="Notes" value={job.notes} />}
            </Card>

            <Card className="p-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="text-base font-bold text-ink-primary">Completion checklist</h2>
                <span className="text-sm font-semibold text-ink-secondary">{done} of {checklist.length}</span>
              </div>
              <div className="px-5 pt-3">
                <div className="h-1.5 rounded bg-neutral-bg overflow-hidden">
                  <div className="h-full bg-brand rounded" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="p-3">
                {checklist.map((c, i) => (
                  <label key={i} className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer text-sm">
                    <input type="checkbox" checked={c.done} onChange={() => toggleItem(i)} className="w-[18px] h-[18px] accent-[var(--color-brand)]" />
                    <span style={{ textDecoration: c.done ? "line-through" : "none", color: c.done ? "var(--ink-muted)" : "var(--ink-primary)" }}>{c.t}</span>
                  </label>
                ))}
                {!checklist.length && <p className="text-sm text-ink-muted px-2 py-2">No checklist items for this job yet.</p>}
              </div>
            </Card>
          </div>

          <div className="flex-1 w-full flex flex-col gap-6">
            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary mb-3">Update status</h2>
              <div className="flex flex-col gap-1.5">
                {STATUS_STEPS.map((s) => {
                  const active = job.status === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => !active && setStatus(s.value)}
                      disabled={pending}
                      className="h-10 px-3 rounded-lg border text-sm font-semibold text-left flex items-center gap-2"
                      style={active ? { background: "var(--ok-bg)", color: "var(--ok-fg)", borderColor: "var(--ok-fg)" } : { background: "#fff", color: "var(--ink-primary)", borderColor: "var(--field-border)" }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary mb-3">Internal notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Visible to your team only"
                className="w-full border border-field-border rounded-md p-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex justify-end mt-2">
                <Button variant="primary" size="sm" onClick={saveNotes} disabled={pending || notes === job.notes}>Save notes</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mb-1">
        <Icon className="w-3.5 h-3.5 text-brand" />
        {label}
      </div>
      <div className="text-sm font-semibold text-ink-primary">{value}</div>
    </div>
  );
}
