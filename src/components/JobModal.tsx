"use client";

import { useState, useTransition } from "react";
import { createJob, deleteJob, updateJob, type JobInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextAreaField } from "@/components/forms";
import type { Job, JobStatus, Recurrence, Skill } from "@/lib/supabase/types";

const DURATIONS = [60, 90, 120, 150, 180, 240];

export interface StaffOption {
  id: string;
  name: string;
}

export interface ClientOption {
  id: string;
  name: string;
  address: string | null;
  job_type: Skill;
}

function toInput(job: Job | null, prefillDate?: string): JobInput {
  if (job) {
    return {
      client: job.client_name,
      address: job.address,
      type: job.job_type,
      status: job.status,
      date: job.job_date,
      startTime: job.start_time ? job.start_time.slice(0, 5) : null,
      duration: job.duration_minutes,
      price: job.price,
      staffId: job.assigned_staff_id,
      notes: job.notes,
      repeat: job.recurrence,
      clientId: job.client_id,
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
    clientId: null,
  };
}

export function JobModal({
  mode,
  job,
  prefillDate,
  staffOptions,
  clientOptions,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  job: Job | null;
  prefillDate?: string;
  staffOptions: StaffOption[];
  clientOptions: ClientOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<JobInput>(() => toInput(job, prefillDate));
  const [selectedClientId, setSelectedClientId] = useState(job?.client_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clientOptions.find((c) => c.id === clientId);
    if (!client) {
      setForm((f) => ({ ...f, clientId: null }));
      return;
    }
    setForm((f) => ({ ...f, clientId: client.id, client: client.name, address: client.address ?? f.address, type: client.job_type }));
  };

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
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-card-bg shadow-2xl overflow-y-auto p-6 z-101 flex flex-col gap-3.5">
        <div className="font-bold text-lg mb-1">
          {mode === "edit" ? "Edit Job" : "New Job"}
        </div>

        {clientOptions.length > 0 && (
          <SelectField
            label="Client"
            value={selectedClientId}
            onChange={(e) => selectClient(e.target.value)}
            options={[{ value: "", label: "Custom / not in directory…" }, ...clientOptions.map((c) => ({ value: c.id, label: c.name }))]}
          />
        )}

        <TextField label="Client name" required value={form.client} onChange={(e) => set("client", e.target.value)} />

        <TextField label="Address" required value={form.address} onChange={(e) => set("address", e.target.value)} />

        <div className="flex gap-2.5">
          <SelectField
            label="Job type"
            className="flex-1"
            value={form.type}
            onChange={(e) => set("type", e.target.value as Skill)}
            options={[
              { value: "cleaning", label: "Cleaning" },
              { value: "gardening", label: "Gardening" },
              { value: "both", label: "Cleaning + Gardening" },
            ]}
          />
          <SelectField
            label="Status"
            className="flex-1"
            value={form.status}
            onChange={(e) => set("status", e.target.value as JobStatus)}
            options={[
              { value: "scheduled", label: "Scheduled" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-secondary -mb-1">
          <input
            type="checkbox"
            checked={form.date == null}
            onChange={(e) => {
              if (e.target.checked) {
                setForm((f) => ({ ...f, date: null, startTime: null, repeat: "none" }));
              } else {
                setForm((f) => ({ ...f, date: prefillDate || new Date().toISOString().slice(0, 10), startTime: "09:00" }));
              }
            }}
            className="accent-brand"
          />
          Leave unscheduled
        </label>

        {form.date != null && (
          <div className="flex gap-2.5">
            <TextField label="Date" required type="date" className="flex-1" value={form.date} onChange={(e) => set("date", e.target.value)} />
            <TextField label="Start time" required type="time" className="flex-1" value={form.startTime ?? ""} onChange={(e) => set("startTime", e.target.value)} />
          </div>
        )}

        <div className="flex gap-2.5">
          <SelectField
            label="Duration"
            className="flex-1"
            value={form.duration}
            onChange={(e) => set("duration", Number(e.target.value))}
            options={DURATIONS.map((d) => ({ value: String(d), label: d % 60 === 0 ? `${d / 60}h` : `${(d / 60).toFixed(1)}h` }))}
          />
          <TextField
            label="Price ($)"
            type="number"
            className="flex-1"
            value={form.price ?? ""}
            onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>

        <div className="flex gap-2.5">
          <SelectField
            label="Assigned staff"
            className="flex-1"
            value={form.staffId ?? ""}
            onChange={(e) => set("staffId", e.target.value || null)}
            options={[{ value: "", label: "Unassigned" }, ...staffOptions.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <SelectField
            label="Repeat"
            className="flex-1"
            value={form.repeat}
            onChange={(e) => set("repeat", e.target.value as Recurrence)}
            disabled={mode === "edit" || form.date == null}
            options={[
              { value: "none", label: "Does not repeat" },
              { value: "weekly", label: "Weekly" },
              { value: "fortnightly", label: "Fortnightly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
        </div>

        <TextAreaField label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5 mt-1.5 items-center">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {mode === "edit" && (
            <button
              onClick={remove}
              disabled={pending}
              className="px-4 py-2.5 rounded-md border text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: "var(--bad-fg)", background: "var(--bad-bg)", color: "var(--bad-fg)" }}
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
