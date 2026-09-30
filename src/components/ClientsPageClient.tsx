"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal, Plus, Tag as TagIcon, X } from "lucide-react";
import { bulkUpdateClientStatus, bulkAddClientTag } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { StatCard } from "@/components/ui/Card";
import { ImportClientsModal } from "@/components/ImportClientsModal";
import type { Client, ClientStatus } from "@/lib/supabase/types";

const STATUSES: (ClientStatus | "All")[] = ["All", "Lead", "Active", "Inactive", "Archived"];

type ClientRow = Client & { lastActivity: string };

function fmtActivity(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (diffDays <= 0) return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function downloadCsv(rows: Client[]) {
  const headers = ["Name", "Company", "Phone", "Email", "Address", "Status", "Tags"];
  const lines = rows.map((c) =>
    [c.name, c.company ?? "", c.phone ?? "", c.email ?? "", c.address ?? "", c.status, (c.tags ?? []).join("; ")]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ClientsPageClient({
  clients,
  lastActivityByClient,
  kpis,
  allTags,
}: {
  clients: Client[];
  lastActivityByClient: Record<string, string>;
  kpis: {
    newLeads30: number;
    newLeadsDelta: number | null;
    newClients30: number;
    newClientsDelta: number | null;
    totalNewClientsYtd: number;
  };
  allTags: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<ClientStatus | "All">("All");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkTagMenu, setShowBulkTagMenu] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  const rows: ClientRow[] = useMemo(
    () => clients.map((c) => ({ ...c, lastActivity: lastActivityByClient[c.id] ?? c.updated_at ?? c.created_at })),
    [clients, lastActivityByClient]
  );

  const filteredClients = useMemo(() => {
    return rows.filter(
      (c) =>
        (status === "All" || c.status === status) &&
        (selectedTags.size === 0 || (c.tags ?? []).some((t) => selectedTags.has(t))) &&
        [c.name, c.company, c.email, c.phone, c.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    );
  }, [rows, searchQuery, status, selectedTags]);

  const sortedClients = useMemo(() => {
    const sorted = [...filteredClients];
    sorted.sort((a, b) => {
      let aVal = (a as unknown as Record<string, unknown>)[sortBy] ?? "";
      let bVal = (b as unknown as Record<string, unknown>)[sortBy] ?? "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if ((aVal as string | number) < (bVal as string | number)) return sortOrder === "asc" ? -1 : 1;
      if ((aVal as string | number) > (bVal as string | number)) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredClients, sortBy, sortOrder]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder(key === "lastActivity" ? "desc" : "asc");
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const runBulkStatus = (newStatus: ClientStatus) => {
    startTransition(async () => {
      await bulkUpdateClientStatus([...selectedIds], newStatus);
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const runBulkTag = (tag: string) => {
    if (!tag.trim()) return;
    startTransition(async () => {
      await bulkAddClientTag([...selectedIds], tag.trim());
      setBulkTagInput("");
      setShowBulkTagMenu(false);
      router.refresh();
    });
  };

  const columns: Column<ClientRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (name: string) => <div className="font-semibold">{name}</div>,
    },
    {
      key: "company",
      label: "Company",
      sortable: true,
      render: (company: string | null) => <span className="text-ink-secondary">{company || "—"}</span>,
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      render: (phone: string) => <span>{phone || "—"}</span>,
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (email: string) => <span className="text-ink-secondary">{email || "—"}</span>,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      render: (address: string) => <span className="text-ink-secondary">{address || "—"}</span>,
    },
    {
      key: "tags",
      label: "Tags",
      sortable: false,
      render: (tags: string[] | null) => (
        <div className="flex flex-wrap gap-1">
          {(tags ?? []).slice(0, 2).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-neutral-bg text-ink-secondary text-xs">
              {t}
            </span>
          ))}
          {(tags ?? []).length > 2 && <span className="text-xs text-ink-muted">+{(tags ?? []).length - 2}</span>}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (s: ClientStatus) => <StatusBadge status={s.toLowerCase() as "lead" | "active" | "inactive" | "archived"} label={s} showDot />,
    },
    {
      key: "lastActivity",
      label: "Last activity",
      sortable: true,
      render: (iso: string) => <span className="text-ink-muted">{fmtActivity(iso)}</span>,
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Clients"
        subtitle={`Manage your client directory. ${clients.length} client${clients.length !== 1 ? "s" : ""} total.`}
        actions={
          <>
            <div className="relative">
              <Button variant="secondary" size="md" onClick={() => setShowMoreActions((v) => !v)}>
                <MoreHorizontal className="w-4 h-4" />
                More actions
              </Button>
              {showMoreActions && (
                <>
                  <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowMoreActions(false)} />
                  <div className="absolute right-0 top-11 z-50 w-56 bg-card-bg border border-line rounded-lg shadow-lg py-1.5">
                    <button
                      onClick={() => {
                        setShowMoreActions(false);
                        setShowImportModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg transition-colors"
                    >
                      Import clients from CSV
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreActions(false);
                        downloadCsv(sortedClients);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-ink-primary hover:bg-page-bg transition-colors"
                    >
                      Export {searchQuery || status !== "All" || selectedTags.size ? "filtered" : "all"} as CSV
                    </button>
                  </div>
                </>
              )}
            </div>
            <Link href="/clients/new">
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4" />
                New client
              </Button>
            </Link>
          </>
        }
      />

      <div className="px-6 py-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="New leads"
              value={kpis.newLeads30}
              subtitle="Past 30 days"
              delta={kpis.newLeadsDelta != null ? { value: `${kpis.newLeadsDelta >= 0 ? "+" : ""}${kpis.newLeadsDelta}%`, trend: kpis.newLeadsDelta >= 0 ? "up" : "down" } : undefined}
            />
            <StatCard
              label="New clients"
              value={kpis.newClients30}
              subtitle="Past 30 days"
              delta={kpis.newClientsDelta != null ? { value: `${kpis.newClientsDelta >= 0 ? "+" : ""}${kpis.newClientsDelta}%`, trend: kpis.newClientsDelta >= 0 ? "up" : "down" } : undefined}
            />
            <StatCard label="Total new clients" value={kpis.totalNewClientsYtd} subtitle="Year to date" />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <FilterTabs
              options={STATUSES.map((s) => ({
                value: s,
                label: s === "All" ? "All statuses" : s,
                count: s === "All" ? clients.length : clients.filter((c) => c.status === s).length,
              }))}
              value={status}
              onChange={setStatus}
            />

            {allTags.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTagMenu((v) => !v)}
                  className={`h-9 px-3.5 rounded-full text-sm font-semibold border flex items-center gap-1.5 transition-colors ${
                    selectedTags.size > 0 ? "bg-forest text-white border-forest" : "bg-card-bg text-ink-primary border-field-border hover:bg-page-bg"
                  }`}
                >
                  <TagIcon className="w-3.5 h-3.5" />
                  Tags
                  {selectedTags.size > 0 && <span className="opacity-80 text-xs">{selectedTags.size}</span>}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showTagMenu && (
                  <>
                    <button type="button" aria-label="Close tag menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowTagMenu(false)} />
                    <div className="absolute left-0 top-11 z-50 w-56 bg-card-bg border border-line rounded-lg shadow-lg py-1.5 max-h-64 overflow-y-auto">
                      {allTags.map((t) => (
                        <label key={t} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-primary hover:bg-page-bg cursor-pointer">
                          <input type="checkbox" checked={selectedTags.has(t)} onChange={() => toggleTag(t)} className="accent-brand" />
                          {t}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, company, email, phone, or address…"
              className="max-w-md"
            />
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-ok-bg border border-ok-fg/20 rounded-lg">
              <span className="text-sm font-semibold text-ok-fg">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => runBulkStatus("Active")}>
                Mark active
              </Button>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => runBulkStatus("Inactive")}>
                Mark inactive
              </Button>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => runBulkStatus("Archived")}>
                Archive
              </Button>
              <div className="relative">
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => setShowBulkTagMenu((v) => !v)}>
                  <TagIcon className="w-3.5 h-3.5" />
                  Add tag
                </Button>
                {showBulkTagMenu && (
                  <>
                    <button type="button" aria-label="Close tag menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowBulkTagMenu(false)} />
                    <div className="absolute right-0 top-10 z-50 w-64 bg-card-bg border border-line rounded-lg shadow-lg p-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          autoFocus
                          value={bulkTagInput}
                          onChange={(e) => setBulkTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && runBulkTag(bulkTagInput)}
                          placeholder="New or existing tag…"
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-field-border text-sm outline-none focus:border-brand"
                        />
                        <Button variant="primary" size="sm" disabled={pending || !bulkTagInput.trim()} onClick={() => runBulkTag(bulkTagInput)}>
                          Add
                        </Button>
                      </div>
                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {allTags.map((t) => (
                            <button
                              key={t}
                              disabled={pending}
                              onClick={() => runBulkTag(t)}
                              className="px-2 py-0.5 rounded-full bg-neutral-bg text-ink-secondary text-xs hover:bg-line-soft transition-colors"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="text-ink-muted hover:text-ink-primary p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <DataTable
            columns={columns}
            data={sortedClients}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            selectable
            selectedIds={selectedIds}
            onSelectAll={(all) => setSelectedIds(all ? new Set(sortedClients.map((c) => c.id)) : new Set())}
            onSelectRow={(id, sel) =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (sel) next.add(id);
                else next.delete(id);
                return next;
              })
            }
            onRowClick={(client) => {
              router.push(`/clients/${client.id}`);
            }}
          />

          {sortedClients.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              {searchQuery ? `No clients match "${searchQuery}"` : "No clients match these filters."}
            </div>
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportClientsModal
          onClose={() => {
            setShowImportModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
