"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, DollarSign, FileText, Loader2, Search, Users, X } from "lucide-react";
import { searchEverything, type SearchHit, type SearchKind } from "@/app/(app)/searchActions";
import { MIN_SEARCH_LENGTH } from "@/lib/searchCore";

const GROUPS: { kind: SearchKind; label: string; icon: typeof Users }[] = [
  { kind: "client", label: "Clients", icon: Users },
  { kind: "job", label: "Jobs", icon: Briefcase },
  { kind: "quote", label: "Quotes", icon: FileText },
  { kind: "invoice", label: "Invoices", icon: DollarSign },
];

/** Debounced search with stale answers ignored. */
function useSearch(query: string) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const latest = useRef(0);
  const q = query.trim();

  useEffect(() => {
    const n = ++latest.current;
    if (q.length < MIN_SEARCH_LENGTH) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchEverything(q);
        if (n === latest.current) {
          setHits(result);
          setSearched(q);
        }
      } catch {
        if (n === latest.current) setHits([]);
      } finally {
        if (n === latest.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const active = q.length >= MIN_SEARCH_LENGTH;
  return { hits: active ? hits : [], loading: active && loading, searched: active ? searched : "" };
}

function Results({ hits, loading, searched, query, cursor, setCursor, open }: { hits: SearchHit[]; loading: boolean; searched: string; query: string; cursor: number; setCursor: (n: number) => void; open: (h: SearchHit) => void }) {
  if (query.trim().length < MIN_SEARCH_LENGTH) {
    return <p className="px-4 py-4 text-sm text-ink-muted">Type at least {MIN_SEARCH_LENGTH} letters to search clients, jobs, quotes and invoices.</p>;
  }
  if (!hits.length) {
    return <p className="px-4 py-4 text-sm text-ink-muted">{loading || searched !== query.trim() ? "Searching…" : `Nothing found for “${query.trim()}”.`}</p>;
  }
  const ordered = GROUPS.flatMap((g) => hits.filter((h) => h.kind === g.kind));
  return (
    <div role="listbox" aria-label="Search results">
      {GROUPS.map((g) => {
        const items = hits.filter((h) => h.kind === g.kind);
        if (!items.length) return null;
        return (
          <div key={g.kind} className="py-1">
            <div className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{g.label}</div>
            {items.map((h) => {
              const i = ordered.indexOf(h);
              const Icon = g.icon;
              return (
                <button
                  key={`${h.kind}-${h.id}`}
                  type="button"
                  role="option"
                  aria-selected={cursor === i}
                  // Keep focus in the box so the list doesn't close before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => open(h)}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-3 ${cursor === i ? "bg-page-bg" : ""}`}
                >
                  <span className="shrink-0 w-8 h-8 rounded-md bg-brand/10 text-brand flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink-primary truncate">{h.title}</span>
                    {h.subtitle && <span className="block text-xs text-ink-muted truncate">{h.subtitle}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Search clients, jobs, quotes and invoices in your business. Computers: a box in the top bar with a results list.
 * Phones: a search icon that opens a full-screen search. Arrow keys move, Enter opens, Escape closes.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const { hits, loading, searched } = useSearch(query);
  const ordered = useMemo(() => GROUPS.flatMap((g) => hits.filter((h) => h.kind === g.kind)), [hits]);

  const reset = () => {
    setQuery("");
    setCursor(0);
    setFocused(false);
    setSheetOpen(false);
  };
  const open = (h: SearchHit) => {
    reset();
    router.push(h.href);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(ordered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && ordered[cursor]) {
      e.preventDefault();
      open(ordered[cursor]);
    } else if (e.key === "Escape") {
      (e.target as HTMLInputElement).blur();
      reset();
    }
  };
  const change = (v: string) => {
    setQuery(v);
    setCursor(0);
  };

  return (
    <>
      {/* Computers and tablets */}
      <div className="hidden md:block relative flex-1 max-w-96 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => change(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search clients, jobs, quotes, invoices"
          aria-label="Search"
          className="w-full pl-10 pr-9 py-2 rounded-md border border-field-border bg-page-bg text-ink-primary placeholder-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-ink-muted" />}
        {focused && query.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card-bg border border-line rounded-lg shadow-lg z-50 max-h-[28rem] overflow-y-auto min-w-80">
            <Results hits={hits} loading={loading} searched={searched} query={query} cursor={cursor} setCursor={setCursor} open={open} />
          </div>
        )}
      </div>

      {/* Phones */}
      <button type="button" onClick={() => setSheetOpen(true)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-line text-ink-primary hover:bg-page-bg" aria-label="Search">
        <Search className="w-5 h-5" />
      </button>
      {/* Rendered at the top of the page: inside the sticky top bar a full-screen layer would be clipped to the bar. */}
      {sheetOpen && createPortal(
        <div className="md:hidden fixed inset-0 z-[60] bg-card-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Search">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-line" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <button type="button" onClick={reset} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-primary" aria-label="Close search">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => change(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search clients, jobs, quotes, invoices"
                aria-label="Search"
                // 16px so the iPhone doesn't zoom in on the box.
                className="w-full pl-3 pr-9 py-2.5 rounded-lg border border-field-border bg-page-bg text-base text-ink-primary placeholder-ink-muted focus:outline-none focus:border-brand"
              />
              {query && (
                <button type="button" onClick={() => change("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-ink-muted" aria-label="Clear search">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Results hits={hits} loading={loading} searched={searched} query={query} cursor={cursor} setCursor={setCursor} open={open} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
