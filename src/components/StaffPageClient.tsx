"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStaffActive } from "@/app/(app)/actions";
import { StaffModal } from "@/components/StaffModal";
import { CrewModal } from "@/components/CrewModal";
import { ToastBanner, useToast } from "@/components/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { initialsOf, staffColorHex } from "@/lib/design";
import { Plus, Mail, Phone } from "lucide-react";
import type { Crew, Staff } from "@/lib/supabase/types";
import type { Column } from "@/components/ui/DataTable";

export function StaffPageClient({
  staffList,
  crews,
}: {
  staffList: (Staff & { upcomingCount: number })[];
  crews: Crew[];
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [modal, setModal] = useState<{ mode: "new" | "edit"; staff: Staff | null } | null>(null);
  const [crewModal, setCrewModal] = useState<{ crew: Crew | null } | null>(null);
  const [, startTransition] = useTransition();

  const onSaved = (message: string) => {
    setModal(null);
    showToast(message);
    router.refresh();
  };

  const onCrewSaved = (message: string) => {
    setCrewModal(null);
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

  const crewName = (id: string | null) => crews.find((c) => c.id === id)?.name ?? "Office";
  const crewColor = (id: string | null) => crews.find((c) => c.id === id)?.color_hex ?? "#CBD5E1";

  const columns: Column<Staff & { upcomingCount: number }>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (name: string, row) => (
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: staffColorHex(row.color_hue) }}
          >
            {initialsOf(name)}
          </div>
          <span className="font-semibold">{name}</span>
        </div>
      ),
    },
    { key: "job_role", label: "Role", sortable: false },
    {
      key: "crew_id",
      label: "Crew",
      sortable: false,
      render: (id: string | null) => (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ background: crewColor(id) }} />
          {crewName(id)}
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: false,
      render: (email: string) => (
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <Mail className="w-4 h-4 flex-shrink-0" />
          {email}
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: false,
      render: (phone: string) => (
        <div className="flex items-center gap-2 text-sm">
          {phone ? (
            <>
              <Phone className="w-4 h-4 text-ink-muted flex-shrink-0" />
              {phone}
            </>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </div>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: false,
      render: (active: boolean) => <StatusBadge status={active ? "active" : "inactive"} label={active ? "Active" : "Inactive"} showDot />,
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-primary">Crews & Staff</h1>
            <p className="text-sm text-ink-secondary mt-1">
              Manage your team and assign jobs. {staffList.length} staff member{staffList.length !== 1 ? "s" : ""} total.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={() => setCrewModal({ crew: null })}>
              <Plus className="w-4 h-4" />
              New crew
            </Button>
            <Button variant="primary" size="md" onClick={() => setModal({ mode: "new", staff: null })}>
              <Plus className="w-4 h-4" />
              Invite staff
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {crews.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {crews.map((c) => {
                const lead = staffList.find((s) => s.id === c.lead_staff_id);
                const members = staffList.filter((s) => s.crew_id === c.id && s.active);
                return (
                  <button key={c.id} onClick={() => setCrewModal({ crew: c })} className="text-left bg-card-bg border border-line rounded-lg p-4">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color_hex }} />
                      {c.name}
                    </div>
                    <div className="text-xs text-ink-secondary mt-1">Lead: {lead?.name ?? "—"}</div>
                    <div className="flex mt-3">
                      {members.map((m) => (
                        <span
                          key={m.id}
                          title={m.name}
                          className="w-7 h-7 rounded-full border-2 border-white -mr-1.5 text-[11px] font-bold flex items-center justify-center text-white"
                          style={{ background: staffColorHex(m.color_hue) }}
                        >
                          {initialsOf(m.name)}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <h2 className="text-xl font-bold text-ink-primary mb-4">Staff directory</h2>
          <DataTable columns={columns} data={staffList} onRowClick={(s) => router.push(`/staff/${s.id}`)} />

          {staffList.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              No staff members yet. Invite your team to get started.
            </div>
          )}
        </div>
      </div>

      {modal && <StaffModal mode={modal.mode} staff={modal.staff} crews={crews} onClose={() => setModal(null)} onSaved={onSaved} />}
      {crewModal && <CrewModal crew={crewModal.crew} staffList={staffList} onClose={() => setCrewModal(null)} onSaved={onCrewSaved} />}
      <ToastBanner message={toast} />
    </div>
  );
}
