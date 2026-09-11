"use client";

import { useState, useTransition } from "react";
import { createJob, deleteJob, updateJob, type JobInput } from "@/app/(app)/actions";
import type { Job, JobStatus, Recurrence, Skill } from "@/lib/supabase/types";

const DURATIONS = [60, 90, 120, 150, 180, 240];

export interface StaffOption {
  id: string;
  name: string;
}

function toInput(job: Job | null, prefillDate?: string): JobInput {
  if (job) {
    return {
      client: job.client_name,
      address: job.address,
      type: job.job_type,
      status: job.status,
      date: job.job_date,
      startTime: job.start_time.slice(0, 5),
      duration: job.duration_minutes,
      price: job.price,
      staffId: job.assigned_staff_id,
      notes: job.notes,
      repeat: job.recurrence,
    };
  }
  return {
    client: "",
    address: "",
    type: "cleaning",
    status: "scheduled",
    date: prefillDate || new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    duration: 90,
    price: null,
    staffId: null,
    notes: "",
    repeat: "none",
  };
}

export function JobModal({
  mode,
  job,
  prefillDate,
  staffOptions,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  job: Job | null;
  prefillDate?: string;
  staffOptions: StaffOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<JobInput>(() => toInput(job, prefillDate));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "new" ? await createJob(form) : await updateJob(job!.id, form);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onSaved(mode === "new" ? "Job created" : "Job updated");
    });
  };

  const remove = () => {
    if (!job) return;
    startTransition(async () => {
      const result = await deleteJob(job.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete job.");
        return;
      }
      onSaved("Job deleted");
    });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-surface shadow-2xl overflow-y-auto p-6 z-101 flex flex-col gap-3.5">
        <div className="font-serif font-semibold text-lg mb-1">
          {mode === "edit" ? "Edit Job" : "New Job"}
        </div>

        <Field label="Client name *">
          <input
            value={form.client}
            onChange={(e) => set("client", e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
          />
        </Field>

        <Field label="Address *">
          <input
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
          />
        </Field>

        <div className="flex gap-2.5">
          <Field label="Job type" className="flex-1">
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as Skill)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            >
              <option value="cleaning">Cleaning</option>
              <option value="gardening">Gardening</option>
              <option value="both">Cleaning + Gardening</option>
            </select>
          </Field>
          <Field label="Status" className="flex-1">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as JobStatus)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            >
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Field label="Date *" className="flex-1">
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            />
          </Field>
          <Field label="Start time *" className="flex-1">
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            />
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Field label="Duration" className="flex-1">
            <select
              value={form.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d % 60 === 0 ? `${d / 60}h` : `${(d / 60).toFixed(1)}h`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price ($)" className="flex-1">
            <input
              type="number"
              value={form.price ?? ""}
              onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            />
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Field label="Assigned staff" className="flex-1">
            <select
              value={form.staffId ?? ""}
              onChange={(e) => set("staffId", e.target.value || null)}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
            >
              <option value="">Unassigned</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Repeat" className="flex-1">
            <select
              value={form.repeat}
              onChange={(e) => set("repeat", e.target.value as Recurrence)}
              disabled={mode === "edit"}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm disabled:opacity-60"
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-y"
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5 mt-1.5 items-center">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-border bg-white text-sm font-medium"
          >
            Cancel
          </button>
          {mode === "edit" && (
            <button
              onClick={remove}
              disabled={pending}
              className="px-4 py-2.5 rounded-lg border text-sm font-semibold"
              style={{ borderColor: "var(--color-danger-border)", background: "var(--color-danger-tint)", color: "var(--color-danger-text)" }}
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={save}
            disabled={pending}
            className="px-4.5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}
