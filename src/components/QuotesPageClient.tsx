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
import type { Client, GstMode, Quote, QuoteStatus } from "@/lib/supabase/types";

const TABS: (QuoteStatus | "All")[] = ["All", "Draft", "Sent", "Approved", "Declined", "Expired"];

type QuoteRow = Quote & { clientName: string; total: number };

function badgeStatus(s: QuoteStatus) {
  return s.toLowerCase() as "draft" | "sent" | "approved" | "declined" | "expired";
}

export function QuotesPageClient({ quotes, clients, itemTotals }: { quotes: Quote[]; clients: Client[]; itemTotals: Map<string, { qty: number; unit_price: number; mode: GstMode }[]> }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const rows: QuoteRow[] = quotes.map((q) => {
    const items = itemTotals.get(q.id) ?? [];
    return { ...q, clientName: clientName(q.client_id), total: calcTotals(items, q.mode).total };
  });

  const filtered = rows.filter(
    (r) => (tab === "All" || r.status === tab) && (!query.trim() || (r.num + " " + r.clientName).toLowerCase().includes(query.toLowerCase()))
  );

  const columns: Column<QuoteRow>[] = [
    { key: "num", label: "Quote", sortable: false },
    { key: "clientName", label: "Client", sortable: false },
    { key: "quote_date", label: "Quote date", sortable: false },
    { key: "expiry_date", label: "Expiry", sortable: false },
    { key: "total", label: "Total (inc. GST)", sortable: false, render: (t: number) => <span className="font-semibold">${t.toFixed(2)}</span> },
    { key: "status", label: "Status", sortable: false, render: (s: QuoteStatus) => <StatusBadge status={badgeStatus(s)} label={s} showDot /> },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Quotes"
        actions={
          <Button variant="primary" size="md" onClick={() => router.push("/quotes/new")}>
            <Plus className="w-4 h-4" />
            New quote
          </Button>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <FilterTabs
              options={TABS.map((t) => ({ value: t, label: t, count: t === "All" ? rows.length : rows.filter((r) => r.status === t).length }))}
              value={tab}
              onChange={setTab}
            />
            <div className="flex-1" />
            <SearchInput value={query} onChange={setQuery} placeholder="Search quotes…" className="max-w-xs" />
          </div>
          <DataTable columns={columns} data={filtered} onRowClick={(q) => router.push(`/quotes/${q.id}`)} />
          {!filtered.length && <div className="text-center py-8 text-ink-muted">No quotes match.</div>}
        </div>
      </div>
    </div>
  );
}
