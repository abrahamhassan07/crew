"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientModal } from "@/components/ClientModal";
import { ToastBanner, useToast } from "@/components/Toast";
import { TYPE_META } from "@/lib/design";
import type { Client } from "@/lib/supabase/types";

export function ClientsPageClient({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [modal, setModal] = useState<{ mode: "new" | "edit"; client: Client | null } | null>(null);

  const onSaved = (message: string) => {
    setModal(null);
    showToast(message);
    router.refresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal({ mode: "new", client: null })}
          className="px-4 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm"
        >
          + Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clients.map((c) => {
          const typeMeta = TYPE_META[c.job_type] ?? TYPE_META.both;
          return (
            <div key={c.id} className="bg-white border border-border rounded-xl p-3.5 flex flex-col gap-1 text-xs leading-snug">
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <div className="font-semibold text-sm leading-tight">{c.name}</div>
                <span
                  className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0"
                  style={{ background: typeMeta.tint, color: typeMeta.hex }}
                >
                  {typeMeta.label}
                </span>
              </div>
              <div className="text-ink-faint">{c.address || "—"}</div>
              <div className="text-ink-faint">{c.phone || "—"}</div>
              <div className="text-ink-faint">{c.email || "—"}</div>
              <div className="h-px bg-border my-1" />
              <div>
                <span className="text-ink-faint">Care provider: </span>
                <span className="font-medium">{c.care_provider || "—"}</span>
              </div>
              <div>
                <span className="text-ink-faint">Case manager: </span>
                <span className="font-medium">{c.case_manager || "—"}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div>
                  <span className="text-ink-faint">Hours: </span>
                  <span className="font-medium">{c.hours_allocated != null ? c.hours_allocated : "—"}</span>
                </div>
                <button
                  onClick={() => setModal({ mode: "edit", client: c })}
                  className="px-2.5 py-1 rounded-md border border-border bg-bg text-xs font-semibold shrink-0"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && <ClientModal mode={modal.mode} client={modal.client} onClose={() => setModal(null)} onSaved={onSaved} />}
      <ToastBanner message={toast} />
    </div>
  );
}
