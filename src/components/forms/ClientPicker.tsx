"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { Field } from "./Field";

export const NEW_CLIENT = "__new__";

interface ClientPickerProps {
  label?: string;
  required?: boolean;
  disabled?: boolean;
  clients: { id: string; name: string }[];
  /** A client id, "" for nothing chosen, or NEW_CLIENT. */
  value: string;
  onChange: (value: string) => void;
  /** Offer "+ New client (not in the list)…" at the top. */
  allowNew?: boolean;
  /** Text for the "nothing chosen" state; when `clearable` it is also a selectable option. */
  emptyLabel?: string;
  clearable?: boolean;
  className?: string;
}

// A searchable dropdown with a capped height, so a long client list never
// turns into a page-high native <select> popup.
export function ClientPicker({
  label = "Client",
  required,
  disabled,
  clients,
  value,
  onChange,
  allowNew,
  emptyLabel = "Select a client",
  clearable,
  className,
}: ClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: { value: string; label: string; kind: "new" | "empty" | "client" }[] = [];
    if (allowNew) list.push({ value: NEW_CLIENT, label: "New client (not in the list)…", kind: "new" });
    if (clearable && !q) list.push({ value: "", label: emptyLabel, kind: "empty" });
    for (const c of clients) if (!q || c.name.toLowerCase().includes(q)) list.push({ value: c.id, label: c.name, kind: "client" });
    return list;
  }, [clients, query, allowNew, clearable, emptyLabel]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = value === NEW_CLIENT ? "New client" : (clients.find((c) => c.id === value)?.name ?? emptyLabel);

  const openMenu = () => {
    if (disabled) return;
    setQuery("");
    setActive(0);
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) choose(rows[active].value);
    }
  };

  return (
    <Field label={label} required={required} className={className}>
      <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-field-border bg-white text-sm text-left text-ink-primary focus:outline-none focus:ring-2 focus:border-brand focus:ring-brand/20 disabled:opacity-60"
        >
          <span className={`truncate ${value === "" ? "text-ink-muted" : ""}`}>{shown}</span>
          <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card-bg border border-line rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 border-b border-line">
              <Search className="w-4 h-4 text-ink-muted shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Search clients…"
                className="w-full py-2 text-sm bg-transparent outline-none"
              />
            </div>
            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {rows.length === 0 && <li className="px-3 py-2 text-sm text-ink-muted">No clients match.</li>}
              {rows.map((r, i) => (
                <li
                  key={`${r.kind}-${r.value}`}
                  role="option"
                  aria-selected={r.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${i === active ? "bg-page-bg" : ""} ${
                    r.kind === "new" ? "font-semibold text-brand" : r.kind === "empty" ? "text-ink-muted" : "text-ink-primary"
                  }`}
                >
                  {r.kind === "new" ? <Plus className="w-4 h-4 shrink-0" /> : <span className="w-4 shrink-0">{r.value === value ? <Check className="w-4 h-4 text-brand" /> : null}</span>}
                  <span className="truncate">{r.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}
