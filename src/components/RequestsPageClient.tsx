"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Plus, X } from "lucide-react";
import { addRequest, convertRequestToJob, updateRequestStatus, type RequestInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { TextField, SelectField, TextAreaField } from "@/components/forms";
import { AU_STATES } from "@/lib/validate";
import { fmtDateLabel } from "@/lib/design";
import type { Client, RequestStatus, Service, ServiceRequest } from "@/lib/supabase/types";

const TABS: (RequestStatus | "All")[] = ["All", "New", "Contacted", "Quoted", "Converted", "Closed"];
const SOURCES = ["Facebook", "Google", "Website", "Referral", "Phone Call", "Walk-in", "Other"];

function blank(): RequestInput {
  return { clientId: null, name: "", phone: "", email: "", serviceId: null, street: "", suburb: "", state: "VIC", postcode: "", preferredDate: null, description: "", source: "Website" };
}

function badgeStatus(s: RequestStatus): "new" | "contacted" | "quoted" | "converted" | "closed" {
  return s.toLowerCase() as "new" | "contacted" | "quoted" | "converted" | "closed";
}

export function RequestsPageClient({ requests, clients, services }: { requests: ServiceRequest[]; clients: Client[]; services: Service[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);
  const [newModal, setNewModal] = useState<RequestInput | null>(null);
  const [convertDate, setConvertDate] = useState<{ date: string; time: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = requests.filter(
    (r) => (tab === "All" || r.status === tab) && (!query.trim() || (r.name + " " + r.num).toLowerCase().includes(query.toLowerCase()))
  );
  const selected = requests.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const setStatus = (id: string, status: RequestStatus) => {
    startTransition(async () => {
      await updateRequestStatus(id, status);
      router.refresh();
    });
  };

  const saveNew = () => {
    if (!newModal) return;
    setError(null);
    startTransition(async () => {
      const result = await addRequest(newModal);
      if (!result.ok) {
        setError(result.error ?? "Could not save request.");
        return;
      }
      setNewModal(null);
      router.refresh();
    });
  };

  const convert = () => {
    if (!selected || !convertDate) return;
    setError(null);
    startTransition(async () => {
      const result = await convertRequestToJob(selected.id, convertDate.date, convertDate.time);
      if (!result.ok) {
        setError(result.error ?? "Could not convert to job.");
        return;
      }
      setConvertDate(null);
      router.push(`/jobs/${result.id}`);
    });
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-primary">Requests</h1>
            <p className="text-sm text-ink-secondary mt-1">Incoming enquiries from your website, phone and referrals.</p>
          </div>
          <Button variant="primary" size="md" onClick={() => setNewModal(blank())}>
            <Plus className="w-4 h-4" />
            New request
          </Button>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {TABS.map((t) => {
              const count = t === "All" ? requests.length : requests.filter((r) => r.status === t).length;
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="h-9 px-3.5 rounded-full text-sm font-semibold border flex items-center gap-1.5"
                  style={active ? { background: "var(--color-forest)", color: "#fff", borderColor: "var(--color-forest)" } : { background: "#fff", color: "var(--ink-primary)", borderColor: "var(--field-border)" }}
                >
                  {t} <span className="opacity-70 text-xs">{count}</span>
                </button>
              );
            })}
            <div className="flex-1" />
            <SearchInput value={query} onChange={setQuery} placeholder="Search requests…" className="max-w-xs" />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="w-full lg:w-[340px] shrink-0 bg-card-bg border border-line rounded-lg overflow-hidden">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="block w-full text-left px-4 py-3.5 border-b border-line-soft"
                  style={{ background: selected?.id === r.id ? "var(--ok-bg)" : "transparent" }}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <StatusBadge status={badgeStatus(r.status)} label={r.status} showDot />
                  </div>
                  <div className="text-sm text-ink-secondary mt-0.5">{r.suburb}</div>
                  <div className="flex gap-2.5 text-xs text-ink-muted mt-1">
                    <span>{r.num}</span>
                    <span>{r.source}</span>
                  </div>
                </button>
              ))}
              {!filtered.length && <div className="p-6 text-center text-sm text-ink-muted">No requests match.</div>}
            </div>

            {selected && (
              <div className="flex-1 w-full bg-card-bg border border-line rounded-lg">
                <div className="flex flex-wrap justify-between gap-3 px-5 py-4 border-b border-line">
                  <div>
                    <div className="text-xs font-semibold text-ink-muted">{selected.num}</div>
                    <h2 className="text-xl font-bold mt-0.5">{selected.name}</h2>
                  </div>
                  <SelectField
                    label="Status"
                    value={selected.status}
                    onChange={(e) => setStatus(selected.id, e.target.value as RequestStatus)}
                    options={(["New", "Contacted", "Quoted", "Converted", "Closed"] as RequestStatus[]).map((s) => ({ value: s, label: s }))}
                  />
                </div>
                <div className="flex flex-wrap gap-2 px-5 py-3.5 border-b border-line">
                  {selected.status !== "Converted" && selected.status !== "Closed" && (
                    <Button variant="secondary" size="sm" onClick={() => setConvertDate({ date: new Date().toISOString().slice(0, 10), time: "09:00" })}>
                      Convert to job
                    </Button>
                  )}
                  {selected.status === "New" && (
                    <Button variant="ghost" size="sm" onClick={() => setStatus(selected.id, "Contacted")}>
                      Mark contacted
                    </Button>
                  )}
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <div className="text-xs font-semibold text-ink-muted mb-1.5">Contact</div>
                    {selected.phone && (
                      <a href={`tel:${selected.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                        <Phone className="w-3.5 h-3.5 text-brand" />
                        {selected.phone}
                      </a>
                    )}
                    {selected.email && (
                      <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-sm text-ink-primary mt-1">
                        <Mail className="w-3.5 h-3.5 text-brand" />
                        {selected.email}
                      </a>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink-muted mb-1.5">Property address</div>
                    <div className="text-sm">{[selected.street, selected.suburb, selected.state, selected.postcode].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink-muted mb-1.5">Preferred service date</div>
                    <div className="text-sm">{selected.preferred_date ? fmtDateLabel(selected.preferred_date) : "No preference"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink-muted mb-1.5">Source</div>
                    <div className="text-sm">{selected.source}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold text-ink-muted mb-1.5">Description</div>
                    <div className="text-sm leading-relaxed">{selected.description}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {newModal && (
        <>
          <div onClick={() => setNewModal(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <span className="text-lg font-bold">New request</span>
                <button onClick={() => setNewModal(null)} aria-label="Close"><X className="w-5 h-5 text-ink-muted" /></button>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SelectField
                    label="Existing client"
                    value={newModal.clientId ?? ""}
                    onChange={(e) => setNewModal({ ...newModal, clientId: e.target.value || null })}
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="New enquiry (not yet a client)"
                  />
                </div>
                {!newModal.clientId && (
                  <>
                    <TextField label="Customer name" required value={newModal.name} onChange={(e) => setNewModal({ ...newModal, name: e.target.value })} />
                    <TextField label="Phone" required value={newModal.phone} onChange={(e) => setNewModal({ ...newModal, phone: e.target.value })} />
                    <TextField label="Email" type="email" value={newModal.email} onChange={(e) => setNewModal({ ...newModal, email: e.target.value })} />
                    <div />
                    <div className="sm:col-span-2">
                      <TextField label="Street address" required value={newModal.street} onChange={(e) => setNewModal({ ...newModal, street: e.target.value })} />
                    </div>
                    <TextField label="Suburb" value={newModal.suburb} onChange={(e) => setNewModal({ ...newModal, suburb: e.target.value })} />
                    <SelectField label="State" value={newModal.state} onChange={(e) => setNewModal({ ...newModal, state: e.target.value })} options={AU_STATES.map((s) => ({ value: s, label: s }))} />
                  </>
                )}
                <SelectField
                  label="Requested service"
                  value={newModal.serviceId ?? ""}
                  onChange={(e) => setNewModal({ ...newModal, serviceId: e.target.value || null })}
                  options={services.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder="Select a service"
                />
                <TextField label="Preferred date" type="date" value={newModal.preferredDate ?? ""} onChange={(e) => setNewModal({ ...newModal, preferredDate: e.target.value || null })} />
                <div className="sm:col-span-2">
                  <SelectField label="Source" value={newModal.source} onChange={(e) => setNewModal({ ...newModal, source: e.target.value })} options={SOURCES.map((s) => ({ value: s, label: s }))} />
                </div>
                <div className="sm:col-span-2">
                  <TextAreaField label="Description" rows={3} value={newModal.description} onChange={(e) => setNewModal({ ...newModal, description: e.target.value })} />
                </div>
                {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
              </div>
              <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-line">
                <Button variant="secondary" onClick={() => setNewModal(null)}>Cancel</Button>
                <Button variant="primary" onClick={saveNew} disabled={pending}>Save request</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {convertDate && (
        <>
          <div onClick={() => setConvertDate(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-sm p-5">
              <h2 className="text-lg font-bold mb-3">Schedule this job</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <TextField label="Date" type="date" value={convertDate.date} onChange={(e) => setConvertDate({ ...convertDate, date: e.target.value })} />
                <TextField label="Start time" type="text" placeholder="09:00" value={convertDate.time} onChange={(e) => setConvertDate({ ...convertDate, time: e.target.value })} />
              </div>
              {error && <p className="text-sm text-danger mb-2">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConvertDate(null)}>Cancel</Button>
                <Button variant="primary" onClick={convert} disabled={pending}>Create job</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
