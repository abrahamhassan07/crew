"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { ClientModal } from "@/components/ClientModal";
import { ToastBanner, useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable } from "@/components/ui/DataTable";
import type { Client } from "@/lib/supabase/types";

export function ClientsPageClient({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [modal, setModal] = useState<{ mode: "new" | "edit"; client: Client | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const onSaved = (message: string) => {
    setModal(null);
    showToast(message);
    router.refresh();
  };

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      [c.name, c.email, c.phone, c.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery]);

  // Sort clients
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
      render: (name: string) => <span className="font-semibold">{name}</span>,
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
      key: "care_provider",
      label: "Care Provider",
      sortable: false,
      render: (provider: string) => <span>{provider || "—"}</span>,
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Page header */}
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

      {/* Content */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Search bar */}
          <div className="mb-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, email, phone, or address…"
              className="max-w-md"
            />
          </div>

          {/* Table */}
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

          {filteredClients.length === 0 && searchQuery && (
            <div className="text-center py-8 text-ink-muted">
              No clients match "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {modal && <ClientModal mode={modal.mode} client={modal.client} onClose={() => setModal(null)} onSaved={onSaved} />}
      <ToastBanner message={toast} />
    </div>
  );
}
