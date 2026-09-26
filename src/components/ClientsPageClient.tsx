"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Client, ClientStatus } from "@/lib/supabase/types";

const STATUSES: (ClientStatus | "All")[] = ["All", "Lead", "Active", "Inactive", "Archived"];

export function ClientsPageClient({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<ClientStatus | "All">("All");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredClients = useMemo(() => {
    return clients.filter(
      (c) =>
        (status === "All" || c.status === status) &&
        [c.name, c.company, c.email, c.phone, c.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery, status]);

  const sortedClients = useMemo(() => {
    const sorted = [...filteredClients];
    sorted.sort((a, b) => {
      let aVal = (a as any)[sortBy] ?? "";
      let bVal = (b as any)[sortBy] ?? "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredClients, sortBy, sortOrder]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (name: string, row: Client) => (
        <div>
          <div className="font-semibold">{name}</div>
          {row.company && <div className="text-xs text-ink-secondary">{row.company}</div>}
        </div>
      ),
    },
    {
      key: "address",
      label: "Address",
      sortable: false,
      render: (address: string) => <span className="text-ink-secondary">{address || "—"}</span>,
    },
    {
      key: "phone",
      label: "Phone",
      sortable: false,
      render: (phone: string) => <span>{phone || "—"}</span>,
    },
    {
      key: "email",
      label: "Email",
      sortable: false,
      render: (email: string) => <span className="text-ink-secondary">{email || "—"}</span>,
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
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-primary">Clients</h1>
            <p className="text-sm text-ink-secondary mt-1">
              Manage your client directory. {clients.length} client{clients.length !== 1 ? "s" : ""} total.
            </p>
          </div>
          <Link href="/clients/new">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New client
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {STATUSES.map((s) => {
              const count = s === "All" ? clients.length : clients.filter((c) => c.status === s).length;
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="h-9 px-3.5 rounded-full text-sm font-semibold border flex items-center gap-1.5"
                  style={
                    active
                      ? { background: "var(--color-forest)", color: "#fff", borderColor: "var(--color-forest)" }
                      : { background: "#fff", color: "var(--ink-primary)", borderColor: "var(--field-border)" }
                  }
                >
                  {s === "All" ? "All statuses" : s}
                  <span className="opacity-70 text-xs">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, company, email, phone, or address…"
              className="max-w-md"
            />
          </div>

          <DataTable
            columns={columns}
            data={sortedClients}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
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
    </div>
  );
}
