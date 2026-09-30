"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { addDays, durationLabel, fmtDateLabel, fmtISO, fmtTime12, initialsOf, staffColorHex, MONTHS } from "@/lib/design";
import { calcTotals } from "@/lib/gst";
import type { Client, Crew, Invoice, Job, Payment, Quote, Service, ServiceCategory, ServiceRequest, Staff } from "@/lib/supabase/types";

type RangeKey = "month" | "3m" | "fytd" | "12m";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
  { key: "fytd", label: "Financial YTD" },
  { key: "12m", label: "Last 12 months" },
];

function fmtAud0(v: number) {
  return v.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}
function fmtAudK(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : fmtAud0(v);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthsBack(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() - n, 1);
}

function rangeFor(key: RangeKey, now: Date): { start: Date; end: Date; note: string } {
  const end = new Date(startOfMonth(now).getFullYear(), startOfMonth(now).getMonth() + 1, 1);
  if (key === "month") {
    return { start: startOfMonth(now), end, note: `${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
  }
  if (key === "3m") {
    const start = monthsBack(now, 2);
    return { start, end, note: `${MONTHS[start.getMonth()]} – ${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
  }
  if (key === "fytd") {
    const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const start = new Date(fyStartYear, 6, 1);
    const todayEnd = addDays(now, 1);
    return { start, end: todayEnd, note: `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}, from 1 July ${fyStartYear}` };
  }
  const start = monthsBack(now, 11);
  return { start, end, note: `${MONTHS[start.getMonth()]} ${start.getFullYear()} – ${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
}

interface Bucket {
  label: string;
  startIso: string;
  endIso: string;
}

function monthBuckets(start: Date, end: Date): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = startOfMonth(start);
  while (cursor < end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    buckets.push({ label: MONTHS[cursor.getMonth()], startIso: fmtISO(cursor), endIso: fmtISO(next) });
    cursor = next;
  }
  return buckets;
}

function weekBuckets(start: Date, end: Date): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const bucketEnd = addDays(cursor, 7);
    const clipped = bucketEnd < end ? bucketEnd : end;
    const lastDay = addDays(clipped, -1);
    buckets.push({ label: `${cursor.getDate()}–${lastDay.getDate()} ${MONTHS[lastDay.getMonth()]}`, startIso: fmtISO(cursor), endIso: fmtISO(clipped) });
    cursor = bucketEnd;
  }
  return buckets;
}

export function ReportsPageClient({
  clients,
  staffList,
  crews,
  services,
  jobs,
  requests,
  quotes,
  invoices,
  invoiceItems,
  payments,
}: {
  clients: Client[];
  staffList: Staff[];
  crews: Crew[];
  services: Service[];
  jobs: Job[];
  requests: ServiceRequest[];
  quotes: Pick<Quote, "id" | "request_id" | "status">[];
  invoices: Invoice[];
  invoiceItems: { invoice_id: string; qty: number; unit_price: number }[];
  payments: Pick<Payment, "invoice_id" | "amount" | "paid_date">[];
}) {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("3m");
  const now = useMemo(() => new Date(), []);
  const today = fmtISO(now);

  const { start, end, note } = useMemo(() => rangeFor(range, now), [range, now]);
  const startIso = fmtISO(start);
  const endIso = fmtISO(end);

  const itemsByInvoice = useMemo(() => {
    const map = new Map<string, { qty: number; unit_price: number }[]>();
    for (const i of invoiceItems) {
      const arr = map.get(i.invoice_id) ?? [];
      arr.push({ qty: i.qty, unit_price: i.unit_price });
      map.set(i.invoice_id, arr);
    }
    return map;
  }, [invoiceItems]);
  const paidByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) map.set(p.invoice_id, (map.get(p.invoice_id) ?? 0) + p.amount);
    return map;
  }, [payments]);

  const openInvoices = useMemo(
    () =>
      invoices
        .filter((i) => ["Sent", "Partially Paid", "Overdue"].includes(i.status))
        .map((i) => {
          const total = calcTotals(itemsByInvoice.get(i.id) ?? [], i.mode).total;
          const paid = paidByInvoice.get(i.id) ?? 0;
          return { inv: i, total, paid, balance: Math.max(0, total - paid) };
        }),
    [invoices, itemsByInvoice, paidByInvoice]
  );

  const revenueInRange = useMemo(() => payments.filter((p) => p.paid_date >= startIso && p.paid_date < endIso).reduce((s, p) => s + p.amount, 0), [payments, startIso, endIso]);

  const jobsCompletedInRange = useMemo(
    () => jobs.filter((j) => j.status === "completed" && j.job_date && j.job_date >= startIso && j.job_date < endIso),
    [jobs, startIso, endIso]
  );

  const newClientsInRange = useMemo(() => clients.filter((c) => c.created_at >= startIso && c.created_at < endIso), [clients, startIso, endIso]);

  const funnel = useMemo(() => {
    const inRange = requests.filter((r) => r.received_at >= startIso && r.received_at < endIso);
    const received = inRange.length;
    const requestIds = new Set(inRange.map((r) => r.id));
    const quotedIds = new Set(quotes.filter((q) => q.request_id && requestIds.has(q.request_id)).map((q) => q.request_id));
    const approvedIds = new Set(quotes.filter((q) => q.request_id && requestIds.has(q.request_id) && q.status === "Approved").map((q) => q.request_id));
    const converted = inRange.filter((r) => r.status === "Converted").length;
    return { received, quoted: quotedIds.size, approved: approvedIds.size, converted };
  }, [requests, quotes, startIso, endIso]);

  const revBars = useMemo(() => {
    const buckets = range === "month" ? weekBuckets(start, end) : monthBuckets(start, end);
    const withVals = buckets.map((b) => ({
      ...b,
      value: payments.filter((p) => p.paid_date >= b.startIso && p.paid_date < b.endIso).reduce((s, p) => s + p.amount, 0),
    }));
    const max = Math.max(1, ...withVals.map((b) => b.value)) * 1.12;
    return withVals.map((b) => ({ ...b, heightPct: Math.round((b.value / max) * 100) }));
  }, [range, start, end, payments]);

  const popularServices = useMemo(() => {
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const counts = new Map<string, { name: string; n: number; rev: number }>();
    for (const j of jobs) {
      if (j.status === "cancelled") continue;
      if (!j.job_date || j.job_date < startIso || j.job_date >= endIso) continue;
      const key = j.service_id ?? "none";
      const name = j.service_id ? (serviceById.get(j.service_id)?.name ?? "Other") : "Other";
      const cur = counts.get(key) ?? { name, n: 0, rev: 0 };
      cur.n += 1;
      cur.rev += j.price ?? 0;
      counts.set(key, cur);
    }
    const rows = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 7);
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.map((r) => ({ ...r, widthPct: Math.round((r.n / max) * 100) }));
  }, [jobs, services, startIso, endIso]);

  const crewUtilisation = useMemo(() => {
    const weekEnd = fmtISO(addDays(now, 7));
    return crews.map((c) => {
      const capacity = staffList.filter((s) => s.crew_id === c.id && s.active).length * 38;
      const hours = jobs
        .filter((j) => j.crew_id === c.id && j.job_date && j.job_date >= today && j.job_date < weekEnd && j.status !== "cancelled")
        .reduce((s, j) => s + j.duration_minutes, 0) / 60;
      const pct = capacity ? Math.min(100, Math.round((hours / capacity) * 100)) : 0;
      return { crew: c, capacity, hours: Math.round(hours), pct };
    });
  }, [crews, staffList, jobs, today, now]);

  const invoiceAging = useMemo(() => {
    const ageDays = (dueIso: string) => Math.floor((now.getTime() - new Date(dueIso).getTime()) / 864e5);
    const buckets: { label: string; lo: number; hi: number; color: string }[] = [
      { label: "Not yet due", lo: -99999, hi: -1, color: "text-ink-primary" },
      { label: "1–30 days", lo: 0, hi: 30, color: "text-warn-fg" },
      { label: "31–60 days", lo: 31, hi: 60, color: "text-bad-fg" },
      { label: "60+ days", lo: 61, hi: 99999, color: "text-bad-fg" },
    ];
    return buckets.map((b) => {
      const rows = openInvoices.filter((x) => {
        const age = ageDays(x.inv.due_date);
        return age >= b.lo && age <= b.hi;
      });
      return { ...b, n: rows.length, value: rows.reduce((s, x) => s + x.balance, 0) };
    });
  }, [openInvoices, now]);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const clientServiceRows = useMemo(() => {
    const categoryOf = (job: Job): ServiceCategory => (job.service_id ? (serviceById.get(job.service_id)?.category ?? "Other") : "Other");
    return clients
      .map((c) => {
        const matched = jobs.filter((j) => j.client_id === c.id && j.job_date && j.job_date >= startIso && j.job_date < endIso && j.status !== "cancelled");
        let gardening = 0;
        let cleaning = 0;
        let other = 0;
        for (const j of matched) {
          const cat = categoryOf(j);
          if (cat === "Gardening") gardening += j.duration_minutes;
          else if (cat === "Cleaning") cleaning += j.duration_minutes;
          else other += j.duration_minutes;
        }
        const completed = matched.filter((j) => j.status === "completed").length;
        const scheduled = matched.filter((j) => j.status === "scheduled" || j.status === "in_progress").length;
        const charge = matched.reduce((s, j) => s + (j.price ?? 0), 0);
        return {
          client: c,
          gardening,
          cleaning,
          other,
          total: gardening + cleaning + other,
          completed,
          scheduled,
          charge,
          jobs: matched.slice().sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? "")),
        };
      })
      .filter((r) => r.jobs.length > 0)
      .sort((a, b) => b.total - a.total);
  }, [clients, jobs, startIso, endIso, serviceById]);

  const staffRows = useMemo(() => {
    return staffList
      .map((s) => {
        const matched = jobs.filter((j) => j.assigned_staff_id === s.id && j.job_date && j.job_date >= startIso && j.job_date < endIso && j.status !== "cancelled");
        const totalMinutes = matched.reduce((sum, j) => sum + j.duration_minutes, 0);
        return { staff: s, totalMinutes, jobCount: matched.length };
      })
      .filter((r) => r.jobCount > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [staffList, jobs, startIso, endIso]);

  const unmatchedJobs = useMemo(
    () => jobs.filter((j) => !j.client_id && j.job_date && j.job_date >= startIso && j.job_date < endIso && j.status !== "cancelled"),
    [jobs, startIso, endIso]
  );

  const revTotal = revBars.reduce((s, b) => s + b.value, 0);
  const kpis = [
    { label: "Revenue", value: fmtAud0(revenueInRange), sub: RANGES.find((r) => r.key === range)?.label ?? "" },
    { label: "Outstanding invoices", value: fmtAud0(openInvoices.reduce((s, x) => s + x.balance, 0)), sub: `${openInvoices.length} open right now` },
    {
      label: "Jobs completed",
      value: jobsCompletedInRange.length.toLocaleString("en-AU"),
      sub: jobsCompletedInRange.length ? `${fmtAud0(revenueInRange / jobsCompletedInRange.length)} average per job` : "No jobs completed",
    },
    { label: "New clients", value: String(newClientsInRange.length), sub: RANGES.find((r) => r.key === range)?.label ?? "" },
    {
      label: "Lead conversion",
      value: funnel.received ? `${Math.round((funnel.converted / funnel.received) * 100)}%` : "—",
      sub: `${funnel.converted} of ${funnel.received} requests booked`,
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Reports"
        subtitle={note}
        actions={
          <div className="flex items-center gap-1 bg-page-bg rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  range === r.key ? "bg-card-bg text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {kpis.map((k) => (
              <div key={k.label} className="bg-card-bg border border-line rounded-lg p-4">
                <div className="text-xs font-semibold text-ink-muted">{k.label}</div>
                <div className="text-2xl font-bold text-ink-primary mt-1.5">{k.value}</div>
                <div className="text-[11px] text-ink-muted mt-1">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 mb-8">
            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary">Revenue</h2>
              <div className="text-xs text-ink-muted mb-4">Payments received, AUD inc. GST</div>
              {revTotal === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-ink-muted">No payments recorded in this period.</div>
              ) : (
                <div className="flex items-end gap-2 h-[200px]">
                  {revBars.map((b) => (
                    <div key={b.label} className="flex-1 h-full flex flex-col justify-end items-center min-w-0" title={`${b.label}: ${fmtAud0(b.value)}`}>
                      <span className="text-[11px] font-bold text-ink-secondary mb-1 whitespace-nowrap">{fmtAudK(b.value)}</span>
                      <div className="w-[72%] max-w-[44px] bg-brand rounded-t" style={{ height: `${Math.max(2, b.heightPct)}%` }} />
                      <span className="text-[11px] text-ink-muted mt-1.5 whitespace-nowrap">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary">Lead conversion</h2>
              <div className="text-xs text-ink-muted mb-4">From enquiry to booked job</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Requests received", n: funnel.received, color: "#B8DDB5" },
                  { label: "Quoted", n: funnel.quoted, color: "#8CC98A" },
                  { label: "Quote approved", n: funnel.approved, color: "#5FA766" },
                  { label: "Converted to job", n: funnel.converted, color: "var(--color-brand)" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold">{s.label}</span>
                      <span>
                        <strong>{s.n}</strong>{" "}
                        <span className="text-ink-muted">{funnel.received && s.n !== funnel.received ? `(${Math.round((s.n / funnel.received) * 100)}%)` : ""}</span>
                      </span>
                    </div>
                    <div className="h-[22px] bg-line-soft rounded-md overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${funnel.received ? (s.n / funnel.received) * 100 : 0}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
                {funnel.received === 0 && <div className="text-sm text-ink-muted">No requests received in this period.</div>}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary">Popular services</h2>
              <div className="text-xs text-ink-muted mb-4">By number of jobs</div>
              <div className="flex flex-col gap-2.5">
                {popularServices.map((p) => (
                  <div key={p.name} className="grid grid-cols-[120px_1fr_90px] gap-3 items-center text-sm">
                    <span className="font-semibold truncate">{p.name}</span>
                    <div className="h-[16px] bg-line-soft rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${p.widthPct}%`, background: "#5FA766" }} />
                    </div>
                    <span className="text-right text-ink-secondary">
                      <strong>{p.n}</strong> · {fmtAudK(p.rev)}
                    </span>
                  </div>
                ))}
                {popularServices.length === 0 && <div className="text-sm text-ink-muted">No jobs in this period.</div>}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary">Crew utilisation</h2>
              <div className="text-xs text-ink-muted mb-4">Booked hours vs. capacity, next 7 days (38 h per person)</div>
              <div className="flex flex-col gap-3.5">
                {crewUtilisation.map((u) => (
                  <div key={u.crew.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: u.crew.color_hex }} />
                        {u.crew.name}
                      </span>
                      <span>
                        <strong>{u.pct}%</strong> <span className="text-ink-muted">({u.hours} of {u.capacity} h)</span>
                      </span>
                    </div>
                    <div className="h-3 bg-line-soft rounded-md overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${u.pct}%`, background: u.crew.color_hex }} />
                    </div>
                  </div>
                ))}
                {crewUtilisation.length === 0 && <div className="text-sm text-ink-muted">No crews set up yet.</div>}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-bold text-ink-primary">Outstanding invoices by age</h2>
              <div className="text-xs text-ink-muted mb-4">Current balances</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {invoiceAging.map((a) => (
                  <div key={a.label} className="border border-line rounded-lg p-3">
                    <div className="text-xs font-semibold text-ink-muted">{a.label}</div>
                    <div className={`text-lg font-bold mt-1.5 ${a.color}`}>{fmtAud0(a.value)}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{a.n} invoice{a.n === 1 ? "" : "s"}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink-primary mb-1">Client Service Hours</h2>
            <p className="text-sm text-ink-muted mb-4">Hours split by service category. Click a row to see the individual jobs.</p>
            {clientServiceRows.length === 0 ? (
              <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted">No jobs with a matched client in this period.</div>
            ) : (
              <div className="bg-card-bg border border-line rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-page-bg">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">Client</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-ink-muted">Gardening</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-ink-muted">Cleaning</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-ink-muted">Other</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-ink-muted">Total</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-ink-muted">Completed</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-ink-muted">Scheduled</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted">Charged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {clientServiceRows.map((r) => {
                        const expanded = expandedClientId === r.client.id;
                        return (
                          <Fragment key={r.client.id}>
                            <tr
                              className="cursor-pointer hover:bg-page-bg transition-colors"
                              onClick={() => setExpandedClientId(expanded ? null : r.client.id)}
                            >
                              <td className="px-4 py-3 text-sm font-semibold flex items-center gap-1.5">
                                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />}
                                {r.client.name}
                              </td>
                              <td className="px-3 py-3 text-sm text-right">{r.gardening ? durationLabel(r.gardening) : "—"}</td>
                              <td className="px-3 py-3 text-sm text-right">{r.cleaning ? durationLabel(r.cleaning) : "—"}</td>
                              <td className="px-3 py-3 text-sm text-right">{r.other ? durationLabel(r.other) : "—"}</td>
                              <td className="px-3 py-3 text-sm text-right font-semibold text-brand">{durationLabel(r.total)}</td>
                              <td className="px-3 py-3 text-sm text-right">{r.completed}</td>
                              <td className="px-3 py-3 text-sm text-right">{r.scheduled}</td>
                              <td className="px-4 py-3 text-sm text-right font-semibold">${r.charge.toFixed(2)}</td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={8} className="bg-page-bg p-0">
                                  <div className="p-4 flex flex-col gap-2">
                                    {r.jobs.map((job) => {
                                      const staff = staffList.find((s) => s.id === job.assigned_staff_id);
                                      const crew = crews.find((c) => c.id === job.crew_id);
                                      const service = job.service_id ? serviceById.get(job.service_id) : undefined;
                                      return (
                                        <div key={job.id} className="bg-card-bg border border-line rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                          <div>
                                            <div className="text-ink-muted">Date</div>
                                            <div className="font-medium text-ink-primary">{job.job_date ? fmtDateLabel(job.job_date) : "Not scheduled"}</div>
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Service</div>
                                            <div className="font-medium text-ink-primary">{service?.name ?? job.title ?? job.job_type}</div>
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Staff</div>
                                            <div className="font-medium text-ink-primary">{staff?.name ?? "Unassigned"}</div>
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Crew</div>
                                            <div className="font-medium text-ink-primary">{crew?.name ?? "—"}</div>
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Start time</div>
                                            <div className="font-medium text-ink-primary">{job.start_time ? fmtTime12(job.start_time.slice(0, 5)) : "—"}</div>
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Duration</div>
                                            <div className="font-medium text-ink-primary">{durationLabel(job.duration_minutes)}</div>
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Status</div>
                                            <StatusBadge
                                              status={job.status === "in_progress" ? "in-progress" : job.status}
                                              label={job.status === "in_progress" ? "In Progress" : job.status[0].toUpperCase() + job.status.slice(1)}
                                              showDot
                                              className="mt-0.5"
                                            />
                                          </div>
                                          <div>
                                            <div className="text-ink-muted">Charge</div>
                                            <div className="font-medium text-ink-primary">{job.price != null ? `$${job.price.toFixed(2)}` : "—"}</div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink-primary mb-4">Staff Hours</h2>
            {staffRows.length === 0 ? (
              <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted">No jobs assigned to staff in this period.</div>
            ) : (
              <div className="space-y-2">
                {staffRows.map(({ staff, totalMinutes, jobCount }) => (
                  <div key={staff.id} className="bg-card-bg border border-line rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ background: staffColorHex(staff.color_hue) }}
                      >
                        {initialsOf(staff.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-ink-primary">{staff.name}</div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {jobCount} job{jobCount === 1 ? "" : "s"} in this period
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-lg text-brand">{durationLabel(totalMinutes)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {unmatchedJobs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Jobs needing attention</h2>
              <p className="text-sm text-ink-muted mb-4">{unmatchedJobs.length} job{unmatchedJobs.length === 1 ? "" : "s"} in this period without a linked client record.</p>
              <div className="space-y-2">
                {unmatchedJobs.map((job) => (
                  <div key={job.id} className="bg-card-bg border border-line rounded-lg p-4">
                    <div className="font-semibold text-ink-primary">{job.client_name}</div>
                    <div className="text-sm text-ink-secondary mt-1">{job.address}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2">
            <h2 className="text-2xl font-bold text-ink-primary mb-4">Outstanding invoices</h2>
            {openInvoices.length === 0 ? (
              <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted">Nothing outstanding right now.</div>
            ) : (
              <div className="bg-card-bg border border-line rounded-lg overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-page-bg">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">Invoice</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">Due</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted">Total</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted">Balance</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {openInvoices
                      .sort((a, b) => a.inv.due_date.localeCompare(b.inv.due_date))
                      .map(({ inv, total, balance }) => {
                        const client = clients.find((c) => c.id === inv.client_id);
                        return (
                          <tr key={inv.id} className="hover:bg-page-bg transition-colors cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                            <td className="px-4 py-3 text-sm font-semibold">{inv.num}</td>
                            <td className="px-4 py-3 text-sm">{client?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-sm text-ink-secondary">{inv.due_date}</td>
                            <td className="px-4 py-3 text-sm text-right">${total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">${balance.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${inv.status === "Overdue" ? "bg-bad-bg text-bad-fg" : "bg-info-bg text-info-fg"}`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
