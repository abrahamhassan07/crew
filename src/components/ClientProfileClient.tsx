"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Phone } from "lucide-react";
import { addClientNote } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { initialsOf } from "@/lib/design";
import type { Client, ClientNote, Property } from "@/lib/supabase/types";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ClientProfileClient({
  client,
  properties,
  notes,
}: {
  client: Client;
  properties: Property[];
  notes: (ClientNote & { staffName: string | null })[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "properties" | "notes">("overview");
  const [noteDraft, setNoteDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const primary = properties[0] ?? null;

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await addClientNote(client.id, text);
      if (result.ok) {
        setNoteDraft("");
        router.refresh();
      }
    });
  };

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "properties" as const, label: "Properties", count: properties.length },
    { key: "notes" as const, label: "Notes", count: notes.length },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-5xl mx-auto">
          <Link href="/clients" className="text-sm font-semibold text-brand mb-3 inline-block">
            ← Clients
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-forest text-white flex items-center justify-center font-bold text-lg shrink-0">
                {initialsOf(client.name)}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-ink-primary">{client.name}</h1>
                  <StatusBadge status={client.status.toLowerCase() as "lead" | "active" | "inactive" | "archived"} label={client.status} showDot />
                </div>
                <div className="text-sm text-ink-secondary mt-1">{client.company || "Residential client"}</div>
                {client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {client.tags.map((t) => (
                      <span key={t} className="px-2.5 py-0.5 rounded-full bg-neutral-bg text-ink-secondary text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Link href={`/clients/${client.id}/edit`}>
              <Button variant="secondary" size="md">
                <Pencil className="w-4 h-4" />
                Edit client
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs font-semibold text-ink-muted mb-2">Contact</div>
              {client.phone && (
                <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                  <Phone className="w-3.5 h-3.5 text-brand" />
                  {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-ink-primary mt-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand" />
                  {client.email}
                </a>
              )}
              {!client.phone && !client.email && <div className="text-sm text-ink-muted">—</div>}
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold text-ink-muted mb-2">Primary address</div>
              <div className="text-sm text-ink-primary">
                {primary ? `${primary.street}${primary.line2 ? `, ${primary.line2}` : ""}, ${primary.suburb} ${primary.state} ${primary.postcode}` : "—"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold text-ink-muted mb-2">Care details</div>
              <div className="text-sm text-ink-primary">{client.care_provider ?? "—"}</div>
              <div className="text-xs text-ink-secondary mt-1">{client.case_manager ? `Case manager: ${client.case_manager}` : ""}</div>
            </Card>
          </div>

          <div role="tablist" className="flex gap-1 border-b border-line">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className="px-3.5 py-3 text-sm font-semibold -mb-px flex items-center gap-1.5"
                style={{ color: tab === t.key ? "var(--color-brand)" : "var(--color-ink-muted)", borderBottom: tab === t.key ? "2px solid var(--color-brand)" : "2px solid transparent" }}
              >
                {t.label}
                {t.count != null && <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-bg text-ink-secondary">{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <Card className="p-6">
              <h2 className="text-base font-bold text-ink-primary mb-3">Recent notes</h2>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                placeholder="Add a note for your team. Clients never see these."
                className="w-full border border-field-border rounded-md p-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex justify-end my-2">
                <Button variant="primary" size="sm" onClick={addNote} disabled={pending || !noteDraft.trim()}>
                  Add note
                </Button>
              </div>
              {notes.slice(0, 3).map((n) => (
                <div key={n.id} className="py-2.5 border-t border-line-soft text-sm">
                  <div className="whitespace-pre-wrap text-ink-primary">{n.text}</div>
                  <div className="text-xs text-ink-muted mt-1">{n.staffName ?? "Unknown"} · {fmtDateTime(n.created_at)}</div>
                </div>
              ))}
              {!notes.length && <p className="text-sm text-ink-muted pt-2">No notes yet.</p>}
            </Card>
          )}

          {tab === "properties" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="text-sm font-semibold text-ink-primary">{p.street}{p.line2 ? `, ${p.line2}` : ""}</div>
                  <div className="text-sm text-ink-secondary">{p.suburb} {p.state} {p.postcode}</div>
                </Card>
              ))}
              {!properties.length && <p className="text-sm text-ink-muted">No properties yet. Add one from Edit client.</p>}
            </div>
          )}

          {tab === "notes" && (
            <Card className="p-6">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                placeholder="Add a note for your team…"
                className="w-full border border-field-border rounded-md p-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex justify-end my-2.5">
                <Button variant="primary" size="sm" onClick={addNote} disabled={pending || !noteDraft.trim()}>
                  Add note
                </Button>
              </div>
              {notes.map((n) => (
                <div key={n.id} className="py-3 border-t border-line-soft text-sm">
                  <div className="whitespace-pre-wrap text-ink-primary">{n.text}</div>
                  <div className="text-xs text-ink-muted mt-1">{n.staffName ?? "Unknown"} · {fmtDateTime(n.created_at)}</div>
                </div>
              ))}
              {!notes.length && <p className="text-sm text-ink-muted pt-2">No notes yet.</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
