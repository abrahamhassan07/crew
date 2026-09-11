"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export interface StaffFilterOption {
  value: string;
  label: string;
}

export function JobsFilterBar({ staffOptions }: { staffOptions: StaffFilterOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`/jobs${params.toString() ? `?${params}` : ""}`);
  };

  const clearAll = () => {
    setSearch("");
    router.push("/jobs");
  };

  return (
    <div className="flex gap-2.5 flex-wrap mb-4 bg-white border border-border rounded-xl p-3.5">
      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && update("search", search)}
        onBlur={() => update("search", search)}
        className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-border text-sm"
      />
      <select
        defaultValue={searchParams.get("status") ?? "all"}
        onChange={(e) => update("status", e.target.value)}
        className="px-3 py-2 rounded-lg border border-border text-sm"
      >
        <option value="all">All statuses</option>
        <option value="scheduled">Scheduled</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select
        defaultValue={searchParams.get("staffId") ?? "all"}
        onChange={(e) => update("staffId", e.target.value)}
        className="px-3 py-2 rounded-lg border border-border text-sm"
      >
        <option value="all">All staff</option>
        <option value="unassigned">Unassigned</option>
        {staffOptions.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("type") ?? "all"}
        onChange={(e) => update("type", e.target.value)}
        className="px-3 py-2 rounded-lg border border-border text-sm"
      >
        <option value="all">All types</option>
        <option value="cleaning">Cleaning</option>
        <option value="gardening">Gardening</option>
        <option value="both">Both</option>
      </select>
      <input
        type="date"
        defaultValue={searchParams.get("from") ?? ""}
        onChange={(e) => update("from", e.target.value)}
        className="px-3 py-2 rounded-lg border border-border text-sm"
      />
      <input
        type="date"
        defaultValue={searchParams.get("to") ?? ""}
        onChange={(e) => update("to", e.target.value)}
        className="px-3 py-2 rounded-lg border border-border text-sm"
      />
      <button onClick={clearAll} className="px-3.5 py-2 rounded-lg border border-border bg-bg text-sm">
        Clear
      </button>
    </div>
  );
}
