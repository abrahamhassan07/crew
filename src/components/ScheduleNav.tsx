"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ScheduleNav({ weekOffset }: { weekOffset: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (offset: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (offset === 0) params.delete("week");
    else params.set("week", String(offset));
    router.push(`/schedule${params.toString() ? `?${params}` : ""}`);
  };

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
    </div>
  );
}
