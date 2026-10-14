"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFeedbackStatus } from "@/app/(app)/actions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { KIND_META, STATUS_LABEL } from "@/components/FeedbackPageClient";
import type { Feedback, FeedbackStatus } from "@/lib/supabase/types";

const STATUSES = Object.keys(STATUS_LABEL) as FeedbackStatus[];

export function AdminFeedbackClient({ items, orgNames }: { items: Feedback[]; orgNames: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<FeedbackStatus | "all">("new");
  const [error, setError] = useState<string | null>(null);

  const shown = tab === "all" ? items : items.filter((f) => f.status === tab);

  const setStatus = (id: string, status: FeedbackStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await updateFeedbackStatus(id, status);
      if (!result.ok) {
        setError(result.error ?? "Could not update.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader title="All feedback" subtitle="From every business using the app. Only you can see this page." />
      <div className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-5">
            <FilterTabs
              options={[
                ...STATUSES.map((s) => ({ value: s as FeedbackStatus | "all", label: STATUS_LABEL[s], count: items.filter((f) => f.status === s).length })),
                { value: "all" as const, label: "All", count: items.length },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          {shown.length === 0 ? (
            <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted text-sm">Nothing here.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((f) => {
                const Icon = KIND_META[f.kind].icon;
                return (
                  <div key={f.id} className="bg-card-bg border border-line rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-primary">{f.title}</div>
                          <div className="text-xs text-ink-muted mt-0.5">
                            {orgNames[f.org_id] ?? "?"} · {f.user_name || f.user_email}
                            {f.user_name ? ` (${f.user_email})` : ""} · {new Date(f.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </div>
                          {f.page && <div className="text-xs text-ink-muted">Page: {f.page}</div>}
                        </div>
                      </div>
                      <select
                        value={f.status}
                        disabled={pending}
                        onChange={(e) => setStatus(f.id, e.target.value as FeedbackStatus)}
                        className="h-9 px-2.5 rounded-md border border-field-border text-sm bg-card-bg text-ink-primary shrink-0"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {f.message && <p className="text-sm text-ink-secondary mt-2.5 whitespace-pre-wrap">{f.message}</p>}
                    <div className="text-[11px] text-ink-faint mt-2 truncate" title={f.user_agent}>{f.user_agent}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
