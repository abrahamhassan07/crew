"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { calcTotals } from "@/lib/gst";
import type { Column } from "@/components/ui/DataTable";
import type { Client, GstMode, Invoice, InvoiceStatus } from "@/lib/supabase/types";

const TABS: (InvoiceStatus | "All")[] = ["All", "Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Voided"];

type InvoiceRow = Invoice & { clientName: string; total: number; balance: number };

function badgeStatus(s: InvoiceStatus) {
  return s.toLowerCase().replace(" ", "-") as "draft" | "sent" | "partially-paid" | "paid" | "overdue" | "voided";
}

export function InvoicesPageClient({
  invoices,
  clients,
  itemsByInvoice,
  paidByInvoice,
  jobNumById,
  paidPast30,
}: {
  invoices: Invoice[];
  clients: Client[];
  itemsByInvoice: Map<string, { qty: number; unit_price: number }[]>;
  paidByInvoice: Map<string, number>;
  jobNumById: Record<string, string>;
  paidPast30: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const rows: InvoiceRow[] = invoices.map((inv) => {
    const items = itemsByInvoice.get(inv.id) ?? [];
    const total = calcTotals(items, inv.mode).total;
    const paid = paidByInvoice.get(inv.id) ?? 0;
    return { ...inv, clientName: clientName(inv.client_id), total, balance: inv.status === "Voided" ? 0 : Math.max(0, total - paid) };
  });

  const filtered = rows.filter(
    (r) => (tab === "All" || r.status === tab) && (!query.trim() || (r.num + " " + r.clientName).toLowerCase().includes(query.toLowerCase()))
  );

  const columns: Column<InvoiceRow>[] = [
    { key: "num", label: "Invoice", sortable: false },
    { key: "clientName", label: "Client", sortable: false },
    { key: "job_id", label: "Job ref", sortable: false, render: (jobId: string | null) => <span className="text-ink-secondary">{jobId ? (jobNumById[jobId] ?? "—") : "—"}</span> },
    { key: "issue_date", label: "Issued", sortable: false },
    { key: "due_date", label: "Due", sortable: false },
    { key: "total", label: "Total", sortable: false, render: (t: number) => <span>${t.toFixed(2)}</span> },
    { key: "balance", label: "Balance", sortable: false, render: (b: number) => <span className="font-semibold">${b.toFixed(2)}</span> },
    { key: "status", label: "Status", sortable: false, render: (s: InvoiceStatus) => <StatusBadge status={badgeStatus(s)} label={s} showDot /> },
  ];

  const open = rows.filter((r) => ["Sent", "Partially Paid", "Overdue"].includes(r.status));
  const overdue = rows.filter((r) => r.status === "Overdue");

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Invoices"
        actions={
          <Button variant="primary" size="md" onClick={() => router.push("/invoices/new")}>
            <Plus className="w-4 h-4" />
            Create invoice
          </Button>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Stat label="Outstanding" value={`$${open.reduce((s, r) => s + r.balance, 0).toFixed(2)}`} sub={`${open.length} open invoices`} />
            <Stat label="Overdue" value={`$${overdue.reduce((s, r) => s + r.balance, 0).toFixed(2)}`} sub={`${overdue.length} past due`} danger />
            <Stat label="Paid, past 30 days" value={`$${paidPast30.toFixed(2)}`} sub="Manually recorded payments" />
            <Stat label="Drafts" value={String(rows.filter((r) => r.status === "Draft").length)} sub="Not yet sent" />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <FilterTabs
              options={TABS.map((t) => ({ value: t, label: t, count: t === "All" ? rows.length : rows.filter((r) => r.status === t).length }))}
              value={tab}
              onChange={setTab}
            />
            <div className="flex-1" />
            <SearchInput value={query} onChange={setQuery} placeholder="Search invoices…" className="max-w-xs" />
          </div>
          <DataTable columns={columns} data={filtered} onRowClick={(inv) => router.push(`/invoices/${inv.id}`)} />
          {!filtered.length && <div className="text-center py-8 text-ink-muted">No invoices match.</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="bg-card-bg border border-line rounded-lg p-4">
      <div className="text-xs font-semibold text-ink-muted">{label}</div>
      <div className="text-2xl font-bold mt-1" style={danger ? { color: "var(--bad-fg)" } : undefined}>{value}</div>
      <div className="text-xs text-ink-muted mt-1">{sub}</div>
    </div>
  );
}
