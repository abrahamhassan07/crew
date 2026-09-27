"use client";

import { useState, useTransition } from "react";
import { inviteStaff, updateStaff, type StaffInput, type StaffUpdateInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/forms";
import type { Crew, JobRole, Skill, Staff } from "@/lib/supabase/types";

const JOB_ROLES: JobRole[] = ["Owner", "Admin", "Manager", "Crew Leader", "Staff"];

export function StaffModal({
  mode,
  staff,
  crews,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  staff: Staff | null;
  crews: Crew[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [skill, setSkill] = useState<Skill>(staff?.skill ?? "both");
  const [active, setActive] = useState(staff?.active ?? true);
  const [crewId, setCrewId] = useState(staff?.crew_id ?? "");
  const [jobRole, setJobRole] = useState<JobRole>(staff?.job_role ?? "Staff");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "new"
          ? await inviteStaff({ name, phone, email, skill, crewId: crewId || null, jobRole } satisfies StaffInput)
          : await updateStaff(staff!.id, {
              name,
              phone,
              email,
              skill,
              active,
              crewId: crewId || null,
              jobRole,
              usualHours: staff?.usual_hours ?? "",
              availability: staff?.availability ?? [true, true, true, true, true, false, false],
            } satisfies StaffUpdateInput);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onSaved(mode === "new" ? "Invite sent" : "Staff updated");
    });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-card-bg shadow-2xl overflow-y-auto p-6 z-101 flex flex-col gap-3.5">
        <div className="font-bold text-lg mb-1">{mode === "edit" ? "Edit Staff" : "Invite Staff"}</div>

        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={mode === "edit"}
          help={mode === "new" ? "We'll email an invite link here." : undefined}
        />
        <SelectField
          label="Skill"
          value={skill}
          onChange={(e) => setSkill(e.target.value as Skill)}
          options={[
            { value: "cleaning", label: "Cleaning" },
            { value: "gardening", label: "Gardening" },
            { value: "both", label: "Cleaning + Gardening" },
          ]}
        />
        <SelectField
          label="Role"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value as JobRole)}
          options={JOB_ROLES.map((r) => ({ value: r, label: r }))}
        />
        <SelectField
          label="Crew"
          value={crewId}
          onChange={(e) => setCrewId(e.target.value)}
          options={[{ value: "", label: "No crew (office)" }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
        />
        {mode === "edit" && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="staffActiveCk" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-brand" />
            <label htmlFor="staffActiveCk" className="text-sm">
              Active
            </label>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5 mt-1.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
