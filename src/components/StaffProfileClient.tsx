"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateStaff, type StaffUpdateInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField, SelectField } from "@/components/forms";
import { initialsOf, staffColorHex, fmtDateLabel, fmtTime12 } from "@/lib/design";
import type { Crew, JobRole, Skill, Staff } from "@/lib/supabase/types";

const JOB_ROLES: JobRole[] = ["Owner", "Admin", "Manager", "Crew Leader", "Staff"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface AssignedJob {
  id: string;
  client_name: string;
  address: string;
  job_date: string;
  start_time: string;
  status: string;
}

export function StaffProfileClient({ staff, crews, assignedJobs }: { staff: Staff; crews: Crew[]; assignedJobs: AssignedJob[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState(staff.phone ?? "");
  const [email, setEmail] = useState(staff.email);
  const [skill, setSkill] = useState<Skill>(staff.skill);
  const [jobRole, setJobRole] = useState<JobRole>(staff.job_role);
  const [crewId, setCrewId] = useState(staff.crew_id ?? "");
  const [usualHours, setUsualHours] = useState(staff.usual_hours);
  const [availability, setAvailability] = useState<boolean[]>(staff.availability);
  const [active, setActive] = useState(staff.active);

  const save = () => {
    setError(null);
    const input: StaffUpdateInput = {
      name: staff.name,
      phone,
      email,
      skill,
      active,
      crewId: crewId || null,
      jobRole,
      usualHours,
      availability,
    };
    startTransition(async () => {
      const result = await updateStaff(staff.id, input);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      router.refresh();
    });
  };

  const toggleActive = (checked: boolean) => {
    setActive(checked);
    startTransition(async () => {
      await updateStaff(staff.id, {
        name: staff.name,
        phone,
        email,
        skill,
        active: checked,
        crewId: crewId || null,
        jobRole,
        usualHours,
        availability,
      });
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-5xl mx-auto">
          <Link href="/staff" className="text-sm font-semibold text-brand mb-3 inline-block">
            ← Crews & Staff
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full text-white flex items-center justify-center font-bold text-lg shrink-0" style={{ background: staffColorHex(staff.color_hue) }}>
                {initialsOf(staff.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-ink-primary">{staff.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={active ? "active" : "inactive"} label={active ? "Active" : "Inactive"} showDot />
                  <span className="text-sm text-ink-secondary">{jobRole}</span>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm font-semibold bg-white border border-line rounded-lg px-3.5 py-2.5 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => toggleActive(e.target.checked)} className="w-[18px] h-[18px] accent-[var(--color-brand)]" />
              Active staff member
            </label>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
          <Card className="p-6 flex-1 w-full flex flex-col gap-4">
            <h2 className="text-base font-bold text-ink-primary">Details</h2>
            <TextField label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <SelectField label="Skill" value={skill} onChange={(e) => setSkill(e.target.value as Skill)} options={[{ value: "cleaning", label: "Cleaning" }, { value: "gardening", label: "Gardening" }, { value: "both", label: "Cleaning + Gardening" }]} />
            <SelectField label="Role" value={jobRole} onChange={(e) => setJobRole(e.target.value as JobRole)} options={JOB_ROLES.map((r) => ({ value: r, label: r }))} />
            <SelectField label="Crew" value={crewId} onChange={(e) => setCrewId(e.target.value)} options={crews.map((c) => ({ value: c.id, label: c.name }))} placeholder="No crew (office)" />
            <TextField label="Usual hours" value={usualHours} onChange={(e) => setUsualHours(e.target.value)} placeholder="7:00 am – 3:30 pm" />
            <div>
              <div className="text-sm font-semibold text-ink-secondary mb-2">Availability</div>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((l, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvailability(availability.map((v, k) => (k === i ? !v : v)))}
                    className="w-11 h-10 rounded-lg text-sm font-bold border"
                    style={availability[i] ? { background: "var(--ok-bg)", color: "var(--ok-fg)", borderColor: "var(--color-brand)" } : { background: "#fff", color: "#94A3B8", borderColor: "var(--field-border)" }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end">
              <Button variant="primary" onClick={save} disabled={pending}>Save changes</Button>
            </div>
          </Card>

          <Card className="p-0 flex-[2] w-full">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-base font-bold text-ink-primary">Assigned jobs</h2>
            </div>
            {assignedJobs.map((j) => (
              <div key={j.id} className="grid grid-cols-[110px_1fr] gap-3 items-center px-5 py-3 border-b border-line-soft text-sm">
                <div>
                  <div className="font-semibold">{fmtDateLabel(j.job_date)}</div>
                  <div className="text-xs text-ink-muted">{fmtTime12(j.start_time)}</div>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{j.client_name}</div>
                  <div className="text-xs text-ink-secondary truncate">{j.address}</div>
                </div>
              </div>
            ))}
            {!assignedJobs.length && <div className="px-5 py-8 text-sm text-ink-muted">No upcoming jobs assigned.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
