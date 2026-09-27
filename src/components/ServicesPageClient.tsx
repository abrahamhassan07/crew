"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addService, toggleServiceActive, updateService, type ServiceInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/SearchInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { TextField, SelectField, TextAreaField } from "@/components/forms";
import { durationLabel } from "@/lib/design";
import type { Column } from "@/components/ui/DataTable";
import type { Crew, PricingType, Service, ServiceCategory } from "@/lib/supabase/types";

const PRICING_TYPES: PricingType[] = ["Fixed", "Hourly", "Per m2", "Per load"];
const UNIT_SUFFIX: Record<PricingType, string> = { Fixed: "", Hourly: "/hr", "Per m2": "/m²", "Per load": "/load" };
const CATEGORIES: ServiceCategory[] = ["Gardening", "Cleaning", "Other"];
const CATEGORY_STYLES: Record<ServiceCategory, string> = {
  Gardening: "bg-ok-bg text-ok-fg",
  Cleaning: "bg-info-bg text-info-fg",
  Other: "bg-neutral-bg text-neutral-fg",
};

function blank(): ServiceInput {
  return { name: "", description: "", price: 0, pricingType: "Fixed", durationMinutes: 60, defaultCrewId: null, category: null, active: true };
}

export function ServicesPageClient({ services, crews }: { services: Service[]; crews: Crew[] }) {
  const [tab, setTab] = useState<"All" | "Active" | "Inactive">("All");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ id: string | null; input: ServiceInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const crewName = (id: string | null) => crews.find((c) => c.id === id)?.name ?? "—";

  const filtered = services.filter(
    (s) =>
      (tab === "All" || (tab === "Active") === s.active) &&
      (!query.trim() || (s.name + " " + s.description).toLowerCase().includes(query.toLowerCase()))
  );

  const toggle = (s: Service) => {
    startTransition(async () => {
      await toggleServiceActive(s.id, !s.active);
    });
  };

  const save = () => {
    if (!modal) return;
    setError(null);
    startTransition(async () => {
      const result = modal.id ? await updateService(modal.id, modal.input) : await addService(modal.input);
      if (!result.ok) {
        setError(result.error ?? "Could not save service.");
        return;
      }
      setModal(null);
    });
  };

  const columns: Column<Service>[] = [
    {
      key: "name",
      label: "Service",
      sortable: false,
      render: (name: string, row: Service) => (
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-ink-secondary">{row.description}</div>
        </div>
      ),
    },
    {
      key: "price",
      label: "Default price",
      sortable: false,
      render: (price: number, row: Service) => <span className="font-semibold">${price.toFixed(2)}{UNIT_SUFFIX[row.pricing_type]}</span>,
    },
    { key: "pricing_type", label: "Pricing type", sortable: false },
    {
      key: "category",
      label: "Category",
      sortable: false,
      render: (category: ServiceCategory | null) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${category ? CATEGORY_STYLES[category] : "bg-neutral-bg text-ink-muted"}`}>
          {category ?? "Uncategorised"}
        </span>
      ),
    },
    {
      key: "duration_minutes",
      label: "Est. duration",
      sortable: false,
      render: (m: number) => <span>{durationLabel(m)}</span>,
    },
    {
      key: "default_crew_id",
      label: "Default crew",
      sortable: false,
      render: (id: string | null) => <span>{crewName(id)}</span>,
    },
    {
      key: "active",
      label: "Active",
      sortable: false,
      render: (active: boolean, row: Service) => (
        <button
          type="button"
          onClick={() => toggle(row)}
          role="switch"
          aria-checked={active}
          className="w-10 h-[22px] rounded-full relative"
          style={{ background: active ? "var(--color-brand)" : "#CBD5E1" }}
        >
          <span className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all" style={{ left: active ? 21 : 3 }} />
        </button>
      ),
    },
    {
      key: "id",
      label: "",
      sortable: false,
      render: (_: string, row: Service) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setModal({
              id: row.id,
              input: {
                name: row.name,
                description: row.description,
                price: row.price,
                pricingType: row.pricing_type,
                durationMinutes: row.duration_minutes,
                defaultCrewId: row.default_crew_id,
                category: row.category,
                active: row.active,
              },
            })
          }
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Services"
        subtitle="Your price list. Defaults fill in automatically on jobs. Prices exclude GST."
        actions={
          <Button variant="primary" size="md" onClick={() => setModal({ id: null, input: blank() })}>
            <Plus className="w-4 h-4" />
            New service
          </Button>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <FilterTabs
              options={(["All", "Active", "Inactive"] as const).map((t) => ({
                value: t,
                label: t,
                count: t === "All" ? services.length : services.filter((s) => (t === "Active") === s.active).length,
              }))}
              value={tab}
              onChange={setTab}
            />
            <div className="flex-1" />
            <SearchInput value={query} onChange={setQuery} placeholder="Search services…" className="max-w-xs" />
          </div>

          <DataTable columns={columns} data={filtered} />
          {!filtered.length && <div className="text-center py-8 text-ink-muted">No services match.</div>}
        </div>
      </div>

      {modal && (
        <>
          <div onClick={() => setModal(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-card-bg rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <span className="text-lg font-bold">{modal.id ? "Edit service" : "New service"}</span>
                <button onClick={() => setModal(null)} aria-label="Close"><X className="w-5 h-5 text-ink-muted" /></button>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <TextField label="Service name" required value={modal.input.name} onChange={(e) => setModal({ ...modal, input: { ...modal.input, name: e.target.value } })} />
                </div>
                <div className="sm:col-span-2">
                  <TextAreaField label="Description" rows={2} value={modal.input.description} onChange={(e) => setModal({ ...modal, input: { ...modal.input, description: e.target.value } })} />
                </div>
                <TextField
                  label="Default price (AUD, ex. GST)"
                  required
                  type="number"
                  min={0}
                  step={0.01}
                  value={modal.input.price || ""}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, price: Number(e.target.value) } })}
                />
                <SelectField
                  label="Pricing type"
                  value={modal.input.pricingType}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, pricingType: e.target.value as PricingType } })}
                  options={PRICING_TYPES.map((t) => ({ value: t, label: t }))}
                />
                <TextField
                  label="Estimated duration (min)"
                  required
                  type="number"
                  min={5}
                  step={5}
                  value={modal.input.durationMinutes || ""}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, durationMinutes: Number(e.target.value) } })}
                />
                <SelectField
                  label="Default crew"
                  value={modal.input.defaultCrewId ?? ""}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, defaultCrewId: e.target.value || null } })}
                  options={crews.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="No crew"
                />
                <SelectField
                  label="Category"
                  help="Used to split hours by category in Reports."
                  value={modal.input.category ?? ""}
                  onChange={(e) => setModal({ ...modal, input: { ...modal.input, category: (e.target.value || null) as ServiceCategory | null } })}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  placeholder="Uncategorised"
                />
                <label className="sm:col-span-2 flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modal.input.active}
                    onChange={(e) => setModal({ ...modal, input: { ...modal.input, active: e.target.checked } })}
                    className="w-[18px] h-[18px] accent-[var(--color-brand)]"
                  />
                  Active — available on new jobs
                </label>
                {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
              </div>
              <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-line">
                <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
                <Button variant="primary" onClick={save} disabled={pending}>Save service</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
