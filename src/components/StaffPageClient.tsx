"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStaffActive } from "@/app/(app)/actions";
import { StaffModal } from "@/components/StaffModal";
import { ToastBanner, useToast } from "@/components/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { initialsOf, staffColorHex } from "@/lib/design";
import { Plus, Mail, Phone } from "lucide-react";
import type { Staff } from "@/lib/supabase/types";
import type { Column } from "@/components/ui/DataTable";

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

  const columns: Column<Staff>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (name: string, row: Staff) => (
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
      key: "skill",
      label: "Skills",
      sortable: false,
      render: (skill: string) => (
        <span className="text-sm">
          {skill === "both" ? "Cleaning + Gardening" : skill === "cleaning" ? "Cleaning" : "Gardening"}
        </span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: false,
      render: (active: boolean, row: Staff) => (
        <StatusBadge
          status={active ? "active" : "inactive"}
          label={active ? "Active" : "Inactive"}
          showDot
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-primary">Staff Directory</h1>
            <p className="text-sm text-ink-secondary mt-1">
              Manage your team and assign jobs. {staffList.length} staff member{staffList.length !== 1 ? "s" : ""} total.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setModal({ mode: "new", staff: null })}
          >
            <Plus className="w-4 h-4" />
            Invite staff
          </Button>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <DataTable columns={columns} data={staffList} />

          {staffList.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              No staff members yet. Invite your team to get started.
            </div>
          )}
        </div>
      </div>

      {modal && <StaffModal mode={modal.mode} staff={modal.staff} onClose={() => setModal(null)} onSaved={onSaved} />}
      <ToastBanner message={toast} />
    </div>
  );
}
