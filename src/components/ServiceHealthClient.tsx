"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Play } from "lucide-react";
import { runAuditNow } from "@/app/(app)/aiActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FREQUENCY_LABEL, STATUS_LABEL } from "@/lib/audit/summary";
import type { ServiceAudit, ServiceAuditItem } from "@/lib/supabase/types";

const ORDER = ["overdue", "not_scheduled", "needs_review", "upcoming", "on_track"];
const TONE: Record<string, string> = { overdue: "text-danger", not_scheduled: "text-warn-fg", needs_review: "text-ink-secondary", upcoming: "text-ink-primary", on_track: "text-ok-fg" };
const fmt = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function ServiceHealthClient({ audits, selected, items, planAllowed, enabled }: { audits: ServiceAudit[]; selected: ServiceAudit | null; items: ServiceAuditItem[]; planAllowed: boolean; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [freq, setFreq] = useState("all");

  const rows = useMemo(
    () =>
      items
        .filter((i) => (status === "all" || i.status === status) && (freq === "all" || i.frequency === freq) && (!q.trim() || `${i.client_name} ${i.service_title}`.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.days_overdue - a.days_overdue || a.client_name.localeCompare(b.client_name)),
    [items, q, status, freq],
  );
  const t = (selected?.totals ?? {}) as unknown as Record<string, number>;

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await runAuditNow();
      if (!res.ok) return setError(res.error ?? "Something went wrong.");
      router.push(`/reports/service-health?audit=${res.auditId}`);
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Client Service Health"
        subtitle="Checks each client's regular service against completed visits and the schedule. Created every Sunday morning."
        back={{ href: "/reports", label: "Reports" }}
        actions={
          <Button variant="primary" onClick={run} disabled={pending || !planAllowed || !enabled}>
            <Play className="w-4 h-4" /> {pending ? "Running…" : "Run Audit Now"}
          </Button>
        }
      />
      <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-[1600px] mx-auto">
      {!planAllowed && <p className="text-sm text-ink-muted mb-3"><span data-app-hide>The Client Service Auditor is included with the Team and Business plans. <Link href="/subscription" className="underline">See plans</Link>.</span><span data-app-only>The Client Service Auditor isn&apos;t part of your current plan.</span></p>}
      {planAllowed && !enabled && <p className="text-sm text-ink-muted mb-3">The auditor is switched off. Turn it on under <Link href="/settings" className="underline">Settings, AI Features</Link>.</p>}
      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {!selected ? (
        <Card className="p-6 text-sm text-ink-muted">No reports yet. Add recurring services on each client&apos;s profile, then run an audit.</Card>
      ) : (
        <>
          <Card className="p-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="text-sm text-ink-muted">As of {fmt(selected.as_of)} · {selected.trigger === "scheduled" ? "weekly report" : "run manually"}</div>
              <div className="flex flex-wrap items-center gap-2">
                {audits.length > 1 && (
                  <select value={selected.id} onChange={(e) => router.push(`/reports/service-health?audit=${e.target.value}`)} className="border border-field-border rounded-md px-2 py-1.5 text-sm bg-card-bg" aria-label="Report">
                    {audits.map((a) => <option key={a.id} value={a.id}>{fmt(a.as_of)}{a.trigger === "manual" ? " (manual)" : ""}</option>)}
                  </select>
                )}
                <a href={`/api/reports/service-health?audit=${selected.id}&format=csv`}><Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> CSV</Button></a>
                <a href={`/api/reports/service-health?audit=${selected.id}&format=pdf`}><Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> PDF</Button></a>
              </div>
            </div>
            <div className={selected.summary ? "grid gap-4 2xl:gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 2xl:items-start" : ""}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {ORDER.map((k) => (
                <button key={k} onClick={() => setStatus(status === k ? "all" : k)} className={`text-left rounded-lg border p-3 ${status === k ? "border-brand" : "border-line"}`}>
                  <div className={`text-2xl font-bold ${TONE[k]}`}>{t[k === "not_scheduled" ? "notScheduled" : k === "needs_review" ? "needsReview" : k === "on_track" ? "onTrack" : k] ?? 0}</div>
                  <div className="text-xs text-ink-muted">{STATUS_LABEL[k]}</div>
                </button>
              ))}
            </div>
            {selected.summary && (
              <div className="rounded-lg bg-page-bg p-4">
                <p className="text-sm text-ink-primary leading-relaxed">{selected.summary}</p>
                {selected.summary_source === "ai" && <p className="text-xs text-ink-muted mt-2">Summary written by AI from the verified figures. The list below is calculated, not generated.</p>}
              </div>
            )}
            </div>
          </Card>

          <Card className="p-5 mb-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client or service" className="border border-field-border rounded-md px-3 py-2 text-sm flex-1 min-w-[180px]" aria-label="Search" />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-field-border rounded-md px-2 py-2 text-sm" aria-label="Status">
                <option value="all">All statuses</option>
                {ORDER.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
              <select value={freq} onChange={(e) => setFreq(e.target.value)} className="border border-field-border rounded-md px-2 py-2 text-sm" aria-label="Frequency">
                <option value="all">All frequencies</option>
                <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="custom">Custom</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-ink-muted"><th className="py-2 pr-4">Client</th><th className="pr-4">Service</th><th className="pr-4">Frequency</th><th className="pr-4 whitespace-nowrap">Last done</th><th className="pr-4 whitespace-nowrap">Next expected</th><th className="pr-4">Booked</th><th className="xl:min-w-[16rem]">Status</th></tr></thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id} className="border-t border-line-soft align-top">
                      <td className="py-2.5 pr-4 font-semibold xl:whitespace-nowrap">{i.client_id ? <Link href={`/clients/${i.client_id}`} className="hover:underline">{i.client_name}</Link> : i.client_name}</td>
                      <td className="py-2.5 pr-4 xl:whitespace-nowrap">{i.service_title}</td>
                      <td className="py-2.5 pr-4 xl:whitespace-nowrap">{FREQUENCY_LABEL(i.frequency, i.interval_days)}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(i.last_completed)}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(i.next_expected)}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(i.next_scheduled)}</td>
                      <td className="py-2.5"><span className={`font-semibold ${TONE[i.status]}`}>{STATUS_LABEL[i.status]}{i.status === "overdue" ? ` · ${i.days_overdue}d` : ""}</span><div className="text-xs text-ink-muted">{i.reason}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="text-sm text-ink-muted py-3">Nothing matches.</p>}
            </div>
          </Card>
        </>
      )}

      </div>
      </div>
    </div>
  );
}
