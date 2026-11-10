"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { addRecurringService, deleteRecurringService, updateRecurringService } from "@/app/(app)/recurringActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { FREQUENCY_LABEL } from "@/lib/audit/summary";
import { todayISO } from "@/lib/design";
import type { RecurringService, ServiceFrequency, Skill } from "@/lib/supabase/types";

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** A client's regular services: what they should receive and how often. The Client Service Auditor checks these. */
export function RecurringServicesPanel({ clientId, services }: { clientId: string; services: RecurringService[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [jobType, setJobType] = useState<Skill>("gardening");
  const [frequency, setFrequency] = useState<ServiceFrequency>("weekly");
  const [interval, setIntervalDays] = useState("10");
  const [anchor, setAnchor] = useState(todayISO());
  const [pauseFor, setPauseFor] = useState<string | null>(null);
  const [pauseDate, setPauseDate] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      after?.();
      router.refresh();
    });
  };

  const today = todayISO();
  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-base font-bold text-ink-primary">Recurring services</h2>
        {!adding && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" />
            Add recurring service
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-muted mb-4">
        What this client should receive, and how often. The Client Service Auditor (Team and Business plans) checks these each week. Repeating jobs you create are added here automatically.
      </p>

      {adding && (
        <div className="rounded-lg border border-line p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Service name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lawn mowing" />
          <SelectField label="Type of work" value={jobType} onChange={(e) => setJobType(e.target.value as Skill)} options={[{ value: "gardening", label: "Gardening" }, { value: "cleaning", label: "Cleaning" }, { value: "both", label: "Cleaning + Gardening" }]} />
          <SelectField label="How often" value={frequency} onChange={(e) => setFrequency(e.target.value as ServiceFrequency)} options={[{ value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" }, { value: "monthly", label: "Monthly (same day each month)" }, { value: "custom", label: "Every number of days" }]} />
          {frequency === "custom" ? <TextField label="Days between visits" inputMode="numeric" value={interval} onChange={(e) => setIntervalDays(e.target.value.replace(/\D/g, ""))} /> : <div />}
          <TextField label="First visit date" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} help="Monthly services repeat on this day of the month." />
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button variant="primary" size="sm" disabled={pending} onClick={() => run(() => addRecurringService(clientId, { title, jobType, frequency, intervalDays: frequency === "custom" ? Number(interval) : null, anchorDate: anchor }), () => { setAdding(false); setTitle(""); })}>
              Save
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAdding(false)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {services.length === 0 ? (
        <p className="text-sm text-ink-muted">No recurring services yet.</p>
      ) : (
        <div className="divide-y divide-line-soft border-t border-line-soft">
          {services.map((s) => {
            const paused = !!s.paused_until && s.paused_until > today;
            return (
              <div key={s.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-ink-primary">{s.title || "Regular service"}</div>
                  <div className="text-xs text-ink-muted">
                    {FREQUENCY_LABEL(s.frequency, s.interval_days)} · first visit {fmt(s.anchor_date)}
                    {!s.active ? " · stopped" : paused ? ` · paused until ${fmt(s.paused_until!)}` : ""}
                  </div>
                </div>
                {s.active && !paused && pauseFor !== s.id && (
                  <Button variant="secondary" size="sm" onClick={() => { setPauseFor(s.id); setPauseDate(""); }} disabled={pending}>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </Button>
                )}
                {pauseFor === s.id && (
                  <span className="flex items-center gap-2">
                    <input type="date" min={today} value={pauseDate} onChange={(e) => setPauseDate(e.target.value)} className="border border-field-border rounded-md px-2 py-1.5 text-sm" aria-label="Pause until" />
                    <Button variant="primary" size="sm" disabled={pending || !pauseDate} onClick={() => run(() => updateRecurringService(s.id, { pausedUntil: pauseDate }), () => setPauseFor(null))}>Pause until</Button>
                    <Button variant="secondary" size="sm" onClick={() => setPauseFor(null)}>Cancel</Button>
                  </span>
                )}
                {(paused || !s.active) && (
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => updateRecurringService(s.id, { active: true, pausedUntil: null }))}>
                    <Play className="w-3.5 h-3.5" /> Resume
                  </Button>
                )}
                {s.active && !paused && (
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => updateRecurringService(s.id, { active: false }))}>Stop</Button>
                )}
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => window.confirm("Remove this recurring service?") && run(() => deleteRecurringService(s.id))} aria-label="Remove recurring service">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
