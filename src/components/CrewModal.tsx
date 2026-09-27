"use client";

import { useState, useTransition } from "react";
import { addCrew, deleteCrew, updateCrew, type CrewInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/forms";
import type { Crew, Staff } from "@/lib/supabase/types";

const PRESET_COLORS: { hex: string; tint: string }[] = [
  { hex: "#287D32", tint: "#E4F2E3" },
  { hex: "#2F6C9E", tint: "#E3EDF6" },
  { hex: "#A0601A", tint: "#F6ECDF" },
  { hex: "#6B4FA0", tint: "#EDE8F6" },
];

export function CrewModal({
  crew,
  staffList,
  onClose,
  onSaved,
}: {
  crew: Crew | null;
  staffList: Staff[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(crew?.name ?? "");
  const [color, setColor] = useState(crew?.color_hex ?? PRESET_COLORS[0].hex);
  const [leadStaffId, setLeadStaffId] = useState(crew?.lead_staff_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    const preset = PRESET_COLORS.find((c) => c.hex === color) ?? PRESET_COLORS[0];
    const input: CrewInput = { name, colorHex: preset.hex, tintHex: preset.tint, leadStaffId: leadStaffId || null };
    startTransition(async () => {
      const result = crew ? await updateCrew(crew.id, input) : await addCrew(input);
      if (!result.ok) {
        setError(result.error ?? "Could not save crew.");
        return;
      }
      onSaved(crew ? "Crew updated" : "Crew created");
    });
  };

  const remove = () => {
    if (!crew) return;
    startTransition(async () => {
      const result = await deleteCrew(crew.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete crew.");
        return;
      }
      onSaved("Crew deleted");
    });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-xl w-full max-w-sm p-5 flex flex-col gap-3.5">
          <div className="text-lg font-bold">{crew ? "Edit crew" : "New crew"}</div>
          <TextField label="Crew name" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Colour</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className="w-8 h-8 rounded-full border-2"
                  style={{ background: c.hex, borderColor: color === c.hex ? "var(--color-ink-primary)" : "transparent" }}
                  aria-label={c.hex}
                />
              ))}
            </div>
          </div>
          <SelectField
            label="Crew lead"
            value={leadStaffId}
            onChange={(e) => setLeadStaffId(e.target.value)}
            options={[{ value: "", label: "No lead set" }, ...staffList.map((s) => ({ value: s.id, label: s.name }))]}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2.5 mt-1.5 items-center">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {crew && (
              <Button variant="danger" onClick={remove} disabled={pending}>
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
