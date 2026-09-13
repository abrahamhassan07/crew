"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function DateRangeFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = (key: "from" | "to", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    params.delete("week");
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  };

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  };

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-ink-faint font-medium">Custom range:</span>
      <input
        type="date"
        defaultValue={from}
        onChange={(e) => update("from", e.target.value)}
        aria-label="From date"
        className="px-3 py-2 rounded-lg border border-border text-sm bg-white"
      />
      <span className="text-xs text-ink-faint">to</span>
      <input
        type="date"
        defaultValue={to}
        onChange={(e) => update("to", e.target.value)}
        aria-label="To date"
        className="px-3 py-2 rounded-lg border border-border text-sm bg-white"
      />
      {(from || to) && (
        <button onClick={clear} className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-xs font-semibold">
          Clear
        </button>
      )}
    </div>
  );
}
