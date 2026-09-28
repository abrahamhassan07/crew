"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import {
  addClient,
  addClientContact,
  addClientNote,
  addProperty,
  removeClientContact,
  removeProperty,
  updateClient,
  type ClientContactInput,
  type ClientInput,
  type PropertyInput,
} from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField, SelectField, TextAreaField, AddressAutocomplete, type ParsedAddress } from "@/components/forms";
import { AU_STATES } from "@/lib/validate";
import type { CareProvider, Client, ClientContact, ClientStatus, Property, Skill } from "@/lib/supabase/types";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "Lead", label: "Lead" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Archived", label: "Archived" },
];

const SOURCE_OPTIONS = ["Facebook", "Google", "Website", "Referral", "Phone Call", "Walk-in", "Other"];

const TAG_SUGGESTIONS = ["Weekly mow", "Commercial", "Property manager", "Fortnightly clean", "Quote sent", "Gate code"];

function splitName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return [fullName, ""];
  return [parts[0], parts.slice(1).join(" ")];
}

function blankProperty(): PropertyInput {
  return { street: "", line2: "", suburb: "", state: "VIC", postcode: "" };
}

function blankContact(): ClientContactInput {
  return { name: "", phone: "", email: "", role: "Other" };
}

export function ClientForm({
  mode,
  client,
  properties,
  contacts = [],
}: {
  mode: "new" | "edit";
  client: Client | null;
  properties: Property[];
  contacts?: ClientContact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(() => splitName(client?.name ?? "")[0]);
  const [lastName, setLastName] = useState(() => splitName(client?.name ?? "")[1]);
  const [company, setCompany] = useState(client?.company ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [jobType, setJobType] = useState<Skill>(client?.job_type ?? "both");
  const [careProvider, setCareProvider] = useState<CareProvider | "">(client?.care_provider ?? "");
  const [caseManager, setCaseManager] = useState(client?.case_manager ?? "");
  const [hoursAllocated, setHoursAllocated] = useState(client?.hours_allocated != null ? String(client.hours_allocated) : "");
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? "Lead");
  const [leadSource, setLeadSource] = useState(client?.lead_source ?? "");
  const [tags, setTags] = useState<string[]>(client?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");

  // "new" mode: properties are local until the client is created.
  const [newProperties, setNewProperties] = useState<PropertyInput[]>([blankProperty()]);
  // "edit" mode: properties already exist in the DB; mutate them directly.
  const [addingProperty, setAddingProperty] = useState<PropertyInput | null>(null);
  const [addingContact, setAddingContact] = useState<ClientContactInput | null>(null);

  const addTag = (t: string) => {
    t = t.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
  };

  const save = (createAnother = false) => {
    setError(null);
    const input: ClientInput = {
      name: `${firstName} ${lastName}`.trim(),
      company,
      address: client?.address ?? "",
      phone,
      email,
      jobType,
      careProvider: careProvider || null,
      caseManager,
      hoursAllocated: hoursAllocated.trim() ? Number(hoursAllocated) : null,
      status,
      tags,
      leadSource,
    };
    startTransition(async () => {
      if (mode === "new") {
        const result = await addClient(input, newProperties);
        if (!result.ok || !result.id) {
          setError(result.error ?? "Could not create client.");
          return;
        }
        if (notes.trim()) await addClientNote(result.id, notes.trim());
        if (createAnother) {
          setFirstName("");
          setLastName("");
          setCompany("");
          setPhone("");
          setEmail("");
          setJobType("both");
          setCareProvider("");
          setCaseManager("");
          setHoursAllocated("");
          setStatus("Lead");
          setLeadSource("");
          setTags([]);
          setNotes("");
          setNewProperties([blankProperty()]);
          router.refresh();
        } else {
          router.push(`/clients/${result.id}`);
        }
      } else {
        const result = await updateClient(client!.id, input);
        if (!result.ok) {
          setError(result.error ?? "Could not save changes.");
          return;
        }
        router.push(`/clients/${client!.id}`);
      }
    });
  };

  const saveNewProperty = () => {
    if (!addingProperty || !client) return;
    const p = addingProperty;
    startTransition(async () => {
      const result = await addProperty(client.id, p);
      if (!result.ok) {
        setError(result.error ?? "Could not add property.");
        return;
      }
      setAddingProperty(null);
      router.refresh();
    });
  };

  const deleteExistingProperty = (id: string) => {
    startTransition(async () => {
      const result = await removeProperty(id);
      if (!result.ok) {
        setError(result.error ?? "Could not remove property.");
        return;
      }
      router.refresh();
    });
  };

  const saveNewContact = () => {
    if (!addingContact || !client) return;
    const c = addingContact;
    startTransition(async () => {
      const result = await addClientContact(client.id, c);
      if (!result.ok) {
        setError(result.error ?? "Could not add contact.");
        return;
      }
      setAddingContact(null);
      router.refresh();
    });
  };

  const deleteExistingContact = (id: string) => {
    startTransition(async () => {
      const result = await removeClientContact(id);
      if (!result.ok) {
        setError(result.error ?? "Could not remove contact.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title={mode === "edit" ? `Edit ${client?.name ?? "client"}` : "New client"}
        subtitle="Fields marked * are required."
        maxWidth="5xl"
      />

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink-primary mb-4">Contact details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <TextField label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              <TextField label="Phone" type="tel" placeholder="0412 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink-primary">Properties</h2>
              {mode === "new" && (
                <Button variant="ghost" size="sm" onClick={() => setNewProperties([...newProperties, blankProperty()])}>
                  <Plus className="w-4 h-4" />
                  Add property
                </Button>
              )}
              {mode === "edit" && !addingProperty && (
                <Button variant="ghost" size="sm" onClick={() => setAddingProperty(blankProperty())}>
                  <Plus className="w-4 h-4" />
                  Add property
                </Button>
              )}
            </div>

            {mode === "new" ? (
              <div className="flex flex-col gap-4">
                {newProperties.map((p, i) => (
                  <div key={i} className="border border-line rounded-lg p-4 bg-page-bg/40">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-ink-primary">{newProperties.length > 1 ? `Property ${i + 1}` : "Primary property"}</span>
                      {newProperties.length > 1 && (
                        <button type="button" onClick={() => setNewProperties(newProperties.filter((_, k) => k !== i))} className="text-danger text-sm font-semibold flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <PropertyFields
                      value={p}
                      onChange={(next) => setNewProperties(newProperties.map((x, k) => (k === i ? next : x)))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {properties.map((p) => (
                  <div key={p.id} className="border border-line rounded-lg p-4 bg-page-bg/40 flex items-start justify-between gap-4">
                    <div className="text-sm text-ink-primary">
                      <div>{p.street}{p.line2 ? `, ${p.line2}` : ""}</div>
                      <div className="text-ink-secondary">{p.suburb} {p.state} {p.postcode}</div>
                    </div>
                    <button type="button" onClick={() => deleteExistingProperty(p.id)} className="text-danger text-sm font-semibold flex items-center gap-1 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                ))}
                {addingProperty && (
                  <div className="border border-line rounded-lg p-4 bg-page-bg/40">
                    <PropertyFields value={addingProperty} onChange={setAddingProperty} />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="secondary" size="sm" onClick={() => setAddingProperty(null)}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={saveNewProperty} disabled={pending}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
                {!properties.length && !addingProperty && <p className="text-sm text-ink-muted">No properties yet.</p>}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink-primary mb-4">Lead & status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <SelectField
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                options={STATUS_OPTIONS}
              />
              <SelectField
                label="Lead source"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                options={SOURCE_OPTIONS.map((s) => ({ value: s, label: s }))}
                placeholder="Select a source"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-ink-secondary">Tags</label>
              <div className="flex flex-wrap items-center gap-2 border border-field-border rounded-md p-2 min-h-[42px]">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-ok-bg text-ok-fg text-xs font-semibold">
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault();
                      addTag(tagInput);
                      setTagInput("");
                    }
                  }}
                  placeholder="Type a tag and press Enter"
                  className="flex-1 min-w-[140px] outline-none text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-xs text-ink-muted">Suggestions:</span>
                {TAG_SUGGESTIONS.filter((t) => !tags.includes(t)).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="px-2 py-0.5 rounded-full border border-field-border text-xs text-ink-secondary hover:bg-page-bg transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
            {mode === "new" && (
              <div className="mt-4">
                <TextAreaField
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Access instructions, pets, preferences…"
                  help="Saved as the first note on this client's profile. Clients never see these."
                />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink-primary mb-4">Care details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Job required"
                value={jobType}
                onChange={(e) => setJobType(e.target.value as Skill)}
                options={[
                  { value: "cleaning", label: "Cleaning" },
                  { value: "gardening", label: "Gardening" },
                  { value: "both", label: "Cleaning + Gardening" },
                ]}
              />
              <SelectField
                label="Care provider"
                value={careProvider}
                onChange={(e) => setCareProvider(e.target.value as CareProvider | "")}
                options={[
                  { value: "AYS", label: "AYS" },
                  { value: "GIHC", label: "GIHC" },
                  { value: "Aurora Home Care", label: "Aurora Home Care" },
                ]}
                placeholder="—"
              />
              <TextField label="Case manager" value={caseManager} onChange={(e) => setCaseManager(e.target.value)} />
              <TextField
                label="Hours allocated"
                type="number"
                min={0}
                step={0.25}
                value={hoursAllocated}
                onChange={(e) => setHoursAllocated(e.target.value)}
              />
            </div>
          </Card>

          {mode === "edit" && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink-primary">Additional contacts</h2>
                {!addingContact && (
                  <Button variant="ghost" size="sm" onClick={() => setAddingContact(blankContact())}>
                    <Plus className="w-4 h-4" />
                    Add contact
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-4">
                {contacts.map((c) => (
                  <div key={c.id} className="border border-line rounded-lg p-4 bg-page-bg/40 flex items-start justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-semibold text-ink-primary">{c.name} <span className="font-normal text-ink-secondary">· {c.role}</span></div>
                      <div className="text-ink-secondary">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <button type="button" onClick={() => deleteExistingContact(c.id)} className="text-danger text-sm font-semibold flex items-center gap-1 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                ))}
                {addingContact && (
                  <div className="border border-line rounded-lg p-4 bg-page-bg/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextField label="Name" required value={addingContact.name} onChange={(e) => setAddingContact({ ...addingContact, name: e.target.value })} />
                    <TextField label="Phone" value={addingContact.phone} onChange={(e) => setAddingContact({ ...addingContact, phone: e.target.value })} />
                    <TextField label="Email" type="email" value={addingContact.email} onChange={(e) => setAddingContact({ ...addingContact, email: e.target.value })} />
                    <SelectField
                      label="Relationship / role"
                      value={addingContact.role}
                      onChange={(e) => setAddingContact({ ...addingContact, role: e.target.value })}
                      options={["Property manager", "Tenant", "Spouse / partner", "Accounts", "Site contact", "Other"].map((r) => ({ value: r, label: r }))}
                    />
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setAddingContact(null)}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={saveNewContact} disabled={pending}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
                {!contacts.length && !addingContact && <p className="text-sm text-ink-muted">No additional contacts.</p>}
              </div>
            </Card>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
            {mode === "new" && (
              <Button variant="secondary" onClick={() => save(true)} disabled={pending}>
                {pending ? "Saving…" : "Save & create another"}
              </Button>
            )}
            <Button variant="primary" onClick={() => save(false)} disabled={pending}>
              {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save client"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertyFields({ value, onChange }: { value: PropertyInput; onChange: (v: PropertyInput) => void }) {
  const handleAddressSelect = (address: ParsedAddress) => {
    onChange({
      ...value,
      street: address.street || value.street,
      suburb: address.suburb || value.suburb,
      state: address.state || value.state,
      postcode: address.postcode || value.postcode,
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
      <div className="sm:col-span-6">
        <AddressAutocomplete
          label="Street address"
          required
          value={value.street}
          onChange={(street) => onChange({ ...value, street })}
          onAddressSelect={handleAddressSelect}
        />
      </div>
      <div className="sm:col-span-6">
        <TextField label="Address line 2" value={value.line2} onChange={(e) => onChange({ ...value, line2: e.target.value })} />
      </div>
      <div className="sm:col-span-3">
        <TextField label="Suburb" required value={value.suburb} onChange={(e) => onChange({ ...value, suburb: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <SelectField
          label="State"
          value={value.state}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          options={AU_STATES.map((s) => ({ value: s, label: s }))}
        />
      </div>
      <div className="sm:col-span-1">
        <TextField label="Postcode" required maxLength={4} value={value.postcode} onChange={(e) => onChange({ ...value, postcode: e.target.value })} />
      </div>
    </div>
  );
}
