"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStaffActive } from "@/app/(app)/actions";
import { StaffModal } from "@/components/StaffModal";
import { ToastBanner, useToast } from "@/components/Toast";
import { initialsOf, staffColorHex } from "@/lib/design";
import type { Staff } from "@/lib/supabase/types";

export function StaffPageClient({ staffList }: { staffList: (Staff & { upcomingCount: number })[] }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [modal, setModal] = useState<{ mode: "new" | "edit"; staff: Staff | null } | null>(null);
  const [, startTransition] = useTransition();

  const onSaved = (message: string) => {
    setModal(null);
    showToast(message);
    router.refresh();
  };

  const toggleActive = (s: Staff) => {
    startTransition(async () => {
      const result = await toggleStaffActive(s.id, !s.active);
      if (result.ok) {
        showToast(s.active ? "Marked inactive" : "Marked active");
        router.refresh();
      }
    });
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal({ mode: "new", staff: null })}
          className="px-4 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm"
        >
          + Invite Staff
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {staffList.map((s) => (
          <div key={s.id} className="bg-white border border-border rounded-2xl p-4.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-[15px] shrink-0"
                style={{ background: staffColorHex(s.color_hue) }}
              >
                {initialsOf(s.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px]">{s.name}</div>
                <div className="text-xs text-ink-faint">
                  {s.skill === "both" ? "Cleaning + Gardening" : s.skill === "cleaning" ? "Cleaning" : "Gardening"}
                </div>
              </div>
            </div>
            <div className="text-[13px] text-ink-faint">{s.phone || "—"}</div>
            <div className="text-[13px] text-ink-faint">{s.email}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-[13px] font-medium">{s.upcomingCount} upcoming</div>
              <button
                onClick={() => toggleActive(s)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold"
                style={
                  s.active
                    ? { background: "var(--color-success-tint)", color: "var(--color-success-strong)" }
                    : { background: "var(--color-surface-alt)", color: "var(--color-ink-faint)" }
                }
              >
                {s.active ? "Active" : "Inactive"}
              </button>
            </div>
            <button
              onClick={() => setModal({ mode: "edit", staff: s })}
              className="mt-1 px-3 py-2 rounded-lg border border-border bg-bg text-[13px] font-semibold"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {modal && <StaffModal mode={modal.mode} staff={modal.staff} onClose={() => setModal(null)} onSaved={onSaved} />}
      <ToastBanner message={toast} />
    </div>
  );
}
