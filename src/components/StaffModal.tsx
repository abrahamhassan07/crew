"use client";

import { useState, useTransition } from "react";
import { inviteStaff, updateStaff, type StaffInput, type StaffUpdateInput } from "@/app/(app)/actions";
import type { Skill, Staff } from "@/lib/supabase/types";

export function StaffModal({
  mode,
  staff,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  staff: Staff | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [skill, setSkill] = useState<Skill>(staff?.skill ?? "both");
  const [active, setActive] = useState(staff?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "new"
          ? await inviteStaff({ name, phone, email, skill } satisfies StaffInput)
          : await updateStaff(staff!.id, { name, phone, email, skill, active } satisfies StaffUpdateInput);

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
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-surface shadow-2xl overflow-y-auto p-6 z-101 flex flex-col gap-3.5">
        <div className="font-serif font-semibold text-lg mb-1">{mode === "edit" ? "Edit Staff" : "Invite Staff"}</div>

        <div>
          <label className="block text-sm font-semibold mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={mode === "edit"}
            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm disabled:opacity-60"
          />
          {mode === "new" && <p className="text-xs text-ink-faint mt-1">We&rsquo;ll email an invite link here.</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Role</label>
          <select value={skill} onChange={(e) => setSkill(e.target.value as Skill)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
            <option value="cleaning">Cleaning</option>
            <option value="gardening">Gardening</option>
            <option value="both">Cleaning + Gardening</option>
          </select>
        </div>
        {mode === "edit" && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="staffActiveCk" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <label htmlFor="staffActiveCk" className="text-sm">
              Active
            </label>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5 mt-1.5">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border bg-white text-sm font-medium">
            Cancel
          </button>
          <div className="flex-1" />
          <button onClick={save} disabled={pending} className="px-4.5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
