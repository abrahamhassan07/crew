"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addEquipment, deleteEquipment, updateEquipment, type EquipmentInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/SearchInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField, SelectField } from "@/components/forms";
import { fmtDateLabel } from "@/lib/design";
import type { Column } from "@/components/ui/DataTable";
import type { Crew, Equipment, EquipmentStatus } from "@/lib/supabase/types";

const STATUSES: EquipmentStatus[] = ["In service", "Needs service", "Out of service"];
const STATUS_BADGE: Record<EquipmentStatus, "active" | "expired" | "cancelled"> = {
  "In service": "active",
  "Needs service": "expired",
  "Out of service": "cancelled",
};

function blank(): EquipmentInput {
  return { name: "", model: "", serial: "", crewId: null, status: "In service", nextServiceDate: null };
}

export function EquipmentPageClient({ equipment, crews }: { equipment: Equipment[]; crews: Crew[] }) {
  const [tab, setTab] = useState<"All" | EquipmentStatus>("All");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ id: string | null; input: EquipmentInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const crewName = (id: string | null) => crews.find((c) => c.id === id)?.name ?? "—";

  const filtered = equipment.filter(
    (e) =>
      (tab === "All" || e.status === tab) &&
      (!query.trim() || (e.name + " " + e.model + " " + e.serial).toLowerCase().includes(query.toLowerCase()))
  );

  const save = () => {
    if (!modal) return;
    setError(null);
    startTransition(async () => {
      const result = modal.id ? await updateEquipment(modal.id, modal.input) : await addEquipment(modal.input);
      if (!result.ok) {
        setError(result.error ?? "Could not save equipment.");
        return;
      }
      setModal(null);
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteEquipment(id);
    });
  };

  const columns: Column<Equipment>[] = [
    {
      key: "name",
      label: "Equipment",
      sortable: false,
      render: (name: string, row: Equipment) => (
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-ink-secondary">{row.model}</div>
        </div>
      ),
    },
    {
      key: "serial",
      label: "Serial",
      sortable: false,
      render: (serial: string) => <span className="text-ink-secondary">{serial || "—"}</span>,
    },
    {
      key: "crew_id",
      label: "Crew",
      sortable: false,
      render: (id: string | null) => <span>{crewName(id)}</span>,
    },
    {
      key: "next_service_date",
      label: "Next service",
      sortable: false,
      render: (d: string | null) => <span className="text-ink-secondary">{d ? fmtDateLabel(d) : "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (s: EquipmentStatus) => <StatusBadge status={STATUS_BADGE[s]} label={s} showDot />,
    },
    {
      key: "id",
      label: "",
      sortable: false,
      render: (id: string, row: Equipment) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setModal({
                id: row.id,
                input: {
                  name: row.name,
                  model: row.model,
                  serial: row.serial,
                  crewId: row.crew_id,
                  status: row.status,
                  nextServiceDate: row.next_service_date,
                },
              })
            }
          >
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={() => remove(id)} disabled={pending}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Equipment"
        subtitle="Track machinery, service schedules and which crew has what."
        actions={
          <Button variant="primary" size="md" onClick={() => setModal({ id: null, input: blank() })}>
            <Plus className="w-4 h-4" />
            Add equipment
          </Button>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <FilterTabs
              options={(["All", ...STATUSES] as const).map((t) => ({
                value: t,
                label: t,
                count: t === "All" ? equipment.length : equipment.filter((e) => e.status === t).length,
              }))}
              value={tab}
              onChange={setTab}
            />
            <div className="flex-1" />
            <SearchInput value={query} onChange={setQuery} placeholder="Search equipment…" className="max-w-xs" />
          </div>

          <DataTable columns={columns} data={filtered} />
          {!filtered.length && <div className="text-center py-8 text-ink-muted">No equipment matches.</div>}
        </div>
      </div>

      {modal && (
        <>
          <div onClick={() => setModal(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-card-bg rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <span className="text-lg font-bold">{modal.id ? "Edit equipment" : "New equipment"}</span>
                <button onClick={() => setModal(null)} aria-label="Close">
                  <X className="w-5 h-5 text-ink-muted" />
                </button>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <TextField label="Name" required value={modal.input.name} onChange={(e) => setModal({ ...modal, input: { ...modal.input, name: e.target.value } })} />
                </div>
                <TextField label="Model" value={modal.input.model} onChange={(e) => setModal({ ...modal, input: { ...modal.input, model: e.target.value } })} />
                <TextField label="Serial number" value={modal.input.serial} onChange={(e) => setModal({ ...modal, input: { ...modal.input, serial: e.target.value } })} />
                <SelectField
                  label="Assigned crew"
                  value={modal.input.crewId ?? ""}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, crewId: e.target.value || null } })}
                  options={crews.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Unassigned"
                />
                <SelectField
                  label="Status"
                  value={modal.input.status}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, status: e.target.value as EquipmentStatus } })}
                  options={STATUSES.map((s) => ({ value: s, label: s }))}
                />
                <TextField
                  label="Next service date"
                  type="date"
                  value={modal.input.nextServiceDate ?? ""}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, nextServiceDate: e.target.value || null } })}
                />
                {error && <p className="sm:col-span-2 text-sm text-danger-red">{error}</p>}
              </div>
              <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-line">
                <Button variant="secondary" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={save} disabled={pending}>
                  Save equipment
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
