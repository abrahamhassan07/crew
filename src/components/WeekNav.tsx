"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addDays, fmtISO, parseISO, startOfWeek } from "@/lib/design";

export function WeekNav({ weekOffset, basePath }: { weekOffset: number; basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (offset: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (offset === 0) params.delete("week");
    else params.set("week", String(offset));
    params.delete("from");
    params.delete("to");
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  };

  const goToDate = (dateStr: string) => {
    if (!dateStr) return;
    const currentWeekStart = startOfWeek(new Date());
    const pickedWeekStart = startOfWeek(parseISO(dateStr));
    const diffDays = Math.round((pickedWeekStart.getTime() - currentWeekStart.getTime()) / 86_400_000);
    go(Math.round(diffDays / 7));
  };

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);

  return (
    <div className="flex items-center gap-3 mb-4.5 flex-wrap">
      <button onClick={() => go(weekOffset - 1)} className="px-3.5 py-2 rounded-lg border border-border bg-white text-sm font-medium">
        &larr; Prev
      </button>
      <button onClick={() => go(weekOffset + 1)} className="px-3.5 py-2 rounded-lg border border-border bg-white text-sm font-medium">
        Next &rarr;
      </button>
      <button onClick={() => go(0)} className="px-3.5 py-2 rounded-lg border border-border bg-accent-tint text-sm font-medium">
        Today
      </button>
      <input
        type="date"
        value={fmtISO(weekStart)}
        onChange={(e) => goToDate(e.target.value)}
        aria-label="Jump to week"
        className="px-3 py-2 rounded-lg border border-border text-sm bg-white"
      />
    </div>
  );
}
