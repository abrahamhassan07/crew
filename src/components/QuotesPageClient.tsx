"use client";

import { useMemo, useState } from "react";
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

const TABS: (QuoteStatus | "All")[] = ["All", "Draft", "Sent", "Approved", "Declined", "Expired", "Cancelled"];

type QuoteRow = Quote & { clientName: string; total: number };

function badgeStatus(s: QuoteStatus) {
  return s.toLowerCase() as "draft" | "sent" | "approved" | "declined" | "expired" | "cancelled";
}

export function QuotesPageClient({ quotes, clients, itemTotals }: { quotes: Quote[]; clients: Client[]; itemTotals: Map<string, { qty: number; unit_price: number; mode: GstMode }[]> }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("quote_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const rows: QuoteRow[] = quotes.map((q) => {
    const items = itemTotals.get(q.id) ?? [];
    return { ...q, clientName: clientName(q.client_id), total: calcTotals(items, q.mode).total };
  });

  const filtered = rows.filter(
    (r) => (tab === "All" || r.status === tab) && (!query.trim() || (r.num + " " + r.clientName).toLowerCase().includes(query.toLowerCase()))
  );

  const sorted = useMemo(() => {
    const dir = sortOrder === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "num":
          return dir * ((parseInt(a.num.replace(/\D/g, ""), 10) || 0) - (parseInt(b.num.replace(/\D/g, ""), 10) || 0));
        case "clientName":
          return dir * a.clientName.localeCompare(b.clientName);
        case "expiry_date":
          return dir * a.expiry_date.localeCompare(b.expiry_date);
        case "total":
          return dir * (a.total - b.total);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "quote_date":
        default:
          return dir * a.quote_date.localeCompare(b.quote_date);
      }
    });
    return arr;
  }, [filtered, sortBy, sortOrder]);

  const columns: Column<QuoteRow>[] = [
    { key: "num", label: "Quote", sortable: true },
    { key: "clientName", label: "Client", sortable: true },
    { key: "quote_date", label: "Quote date", sortable: true },
    { key: "expiry_date", label: "Expiry", sortable: true },
    { key: "total", label: "Total (inc. GST)", sortable: true, render: (t: number) => <span className="font-semibold">${t.toFixed(2)}</span> },
    { key: "status", label: "Status", sortable: true, render: (s: QuoteStatus) => <StatusBadge status={badgeStatus(s)} label={s} showDot /> },
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
          <DataTable
            columns={columns}
            data={sorted}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(q) => router.push(`/quotes/${q.id}`)}
          />
          {!filtered.length && <div className="text-center py-8 text-ink-muted">No quotes match.</div>}
        </div>
      </div>
    </div>
  );
}
