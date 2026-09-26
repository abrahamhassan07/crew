"use client";

import { useState, useTransition } from "react";
import { addCrew, deleteCrew, updateCrew, type CrewInput } from "@/app/(app)/actions";
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
        <div className="bg-white rounded-xl w-full max-w-sm p-5 flex flex-col gap-3.5">
          <div className="text-lg font-bold">{crew ? "Edit crew" : "New crew"}</div>
          <div>
            <label className="block text-sm font-semibold mb-1">Crew name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Colour</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className="w-8 h-8 rounded-full border-2"
                  style={{ background: c.hex, borderColor: color === c.hex ? "#18313D" : "transparent" }}
                  aria-label={c.hex}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Crew lead</label>
            <select value={leadStaffId} onChange={(e) => setLeadStaffId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm">
              <option value="">No lead set</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2.5 mt-1.5 items-center">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-field-border bg-white text-sm font-medium">
              Cancel
            </button>
            {crew && (
              <button onClick={remove} disabled={pending} className="px-4 py-2.5 rounded-lg border border-danger text-danger text-sm font-semibold">
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button onClick={save} disabled={pending} className="px-4.5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
