"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffModal } from "@/components/StaffModal";
import { CrewModal } from "@/components/CrewModal";
import { ToastBanner, useToast } from "@/components/Toast";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { initialsOf, staffColorHex } from "@/lib/design";
import { ChevronDown, Plus, UserPlus, Users as UsersIcon } from "lucide-react";
import type { Crew, JobRole, Staff } from "@/lib/supabase/types";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const ROLE_STYLES: Record<JobRole, string> = {
  Owner: "bg-ink-primary text-white",
  Admin: "bg-info-bg text-info-fg",
  Manager: "bg-violet-bg text-violet-fg",
  "Crew Leader": "bg-ok-bg text-ok-fg",
  Staff: "bg-neutral-bg text-neutral-fg",
};

type StaffRow = Staff & { upcomingCount: number };
type CrewWithStats = Crew & { jobsToday: number; jobsThisWeek: number };

export function StaffPageClient({
  staffList,
  crews,
}: {
  staffList: StaffRow[];
  crews: CrewWithStats[];
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [modal, setModal] = useState<{ mode: "new" | "edit"; staff: Staff | null } | null>(null);
  const [crewModal, setCrewModal] = useState<{ crew: Crew | null } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"Active" | "Inactive" | "All">("Active");
  const [roleFilter, setRoleFilter] = useState<JobRole | "all">("all");
  const [query, setQuery] = useState("");

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

  const crewName = (id: string | null) => crews.find((c) => c.id === id)?.name ?? "Office";
  const crewColor = (id: string | null) => crews.find((c) => c.id === id)?.color_hex ?? "#CBD5E1";

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (activeTab === "Active" && !s.active) return false;
      if (activeTab === "Inactive" && s.active) return false;
      if (roleFilter !== "all" && s.job_role !== roleFilter) return false;
      if (query.trim() && !s.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [staffList, activeTab, roleFilter, query]);

  const columns: Column<StaffRow>[] = [
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
    {
      key: "job_role",
      label: "Role",
      sortable: false,
      render: (role: JobRole) => <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_STYLES[role]}`}>{role}</span>,
    },
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
      label: "Contact",
      sortable: false,
      render: (email: string, row) => (
        <div className="text-sm">
          {row.phone && <div className="font-medium">{row.phone}</div>}
          <div className="text-ink-secondary">{email}</div>
        </div>
      ),
    },
    {
      key: "upcomingCount",
      label: "Assigned jobs (7 days)",
      sortable: true,
      render: (count: number) => <span className={count > 0 ? "font-semibold" : "text-ink-muted"}>{count > 0 ? count : "—"}</span>,
    },
    {
      key: "availability",
      label: "Availability",
      sortable: false,
      render: (availability: boolean[]) => (
        <div className="flex gap-1">
          {DAY_LABELS.map((d, i) => (
            <span
              key={i}
              className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                availability?.[i] ? "bg-ok-bg text-ok-fg" : "bg-neutral-bg text-ink-muted"
              }`}
            >
              {d}
            </span>
          ))}
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
      <PageHeader
        title="Crews & Staff"
        subtitle={`Manage your team and assign jobs. ${staffList.length} staff member${staffList.length !== 1 ? "s" : ""} total.`}
        actions={
          <div className="relative">
            <Button variant="primary" size="md" onClick={() => setShowAddMenu((v) => !v)}>
              <Plus className="w-4 h-4" />
              Add staff member
              <ChevronDown className="w-4 h-4" />
            </Button>
            {showAddMenu && (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowAddMenu(false)} />
                <div className="absolute right-0 top-11 z-50 w-52 bg-card-bg border border-line rounded-lg shadow-lg py-1.5">
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      setModal({ mode: "new", staff: null });
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg"
                  >
                    <UserPlus className="w-4 h-4 text-brand" />
                    Invite staff
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      setCrewModal({ crew: null });
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg"
                  >
                    <UsersIcon className="w-4 h-4 text-brand" />
                    New crew
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
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
                    <div className="flex items-center gap-2 text-xs text-ink-muted mt-3 pt-3 border-t border-line-soft">
                      <span>
                        <span className="font-semibold text-ink-primary">{c.jobsToday}</span> today
                      </span>
                      <span>·</span>
                      <span>
                        <span className="font-semibold text-ink-primary">{c.jobsThisWeek}</span> this week
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-ink-primary">Staff directory</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterTabs
                options={(["Active", "Inactive", "All"] as const).map((t) => ({
                  value: t,
                  label: t,
                  count: t === "Active" ? staffList.filter((s) => s.active).length : t === "Inactive" ? staffList.filter((s) => !s.active).length : staffList.length,
                }))}
                value={activeTab}
                onChange={setActiveTab}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as JobRole | "all")}
                className="h-9 px-3 rounded-md border border-field-border text-sm bg-card-bg text-ink-primary"
              >
                <option value="all">All roles</option>
                {(["Owner", "Admin", "Manager", "Crew Leader", "Staff"] as JobRole[]).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <SearchInput value={query} onChange={setQuery} placeholder="Search staff…" className="w-48" />
            </div>
          </div>

          <DataTable columns={columns} data={filteredStaff} onRowClick={(s) => router.push(`/staff/${s.id}`)} />

          {filteredStaff.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              {staffList.length === 0 ? "No staff members yet. Invite your team to get started." : "No staff match these filters."}
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
