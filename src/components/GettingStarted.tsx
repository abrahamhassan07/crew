"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

export interface GettingStartedProps {
  hasBusinessDetails: boolean;
  hasPaymentDetails: boolean;
  hasClient: boolean;
  hasQuote: boolean;
  hasInvoice: boolean;
  hasTwoFactor: boolean;
}

const SKIPPED_KEY = "crew-getting-started-skipped";
const HIDDEN_KEY = "crew-getting-started-hidden";

// Skipping is a per-browser convenience, so it lives in localStorage. The
// server snapshot is null, so nothing renders until the browser state is read
// (no flash of the full card).
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const snapshot = () => {
  try {
    return `${localStorage.getItem(HIDDEN_KEY) ?? ""}|${localStorage.getItem(SKIPPED_KEY) ?? "[]"}`;
  } catch {
    return "|[]";
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((l) => l());
};

export function GettingStarted(p: GettingStartedProps) {
  const state = useSyncExternalStore(subscribe, snapshot, () => null);
  if (state === null) return null;
  const [hiddenRaw, skippedRaw] = state.split("|");
  const hidden = hiddenRaw === "1";
  let skipped: string[] = [];
  try {
    skipped = JSON.parse(skippedRaw) as string[];
  } catch {}

  const steps = [
    { done: p.hasBusinessDetails, label: "Add your business details", hint: "Shown on quotes and invoices.", href: "/settings", cta: "Open settings" },
    { done: p.hasPaymentDetails, label: "Add your payment details", hint: "Fills in on every new invoice.", href: "/settings", cta: "Open settings" },
    { done: p.hasClient, label: "Add your first client", hint: "Or pick “New client” when you create a quote or job.", href: "/clients/new", cta: "New client" },
    { done: p.hasQuote, label: "Send your first quote", hint: "It's emailed to the client as a PDF.", href: "/quotes/new", cta: "New quote" },
    { done: p.hasInvoice, label: "Create your first invoice", hint: "Record payments against it as they come in.", href: "/invoices/new", cta: "New invoice" },
    { done: p.hasTwoFactor, label: "Turn on two-factor sign-in", hint: "Protect your business data with a code from your phone.", href: "/security", cta: "Open security" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const remaining = steps.filter((s) => !s.done && !skipped.includes(s.label));
  if (hidden || doneCount === steps.length || remaining.length === 0) return null;

  const skip = (label: string) => save(SKIPPED_KEY, JSON.stringify([...skipped, label]));
  const hide = () => save(HIDDEN_KEY, "1");

  return (
    <div className="bg-card-bg border border-line rounded-lg px-4 py-3 mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-ink-primary">Get started</h2>
        <span className="text-xs text-ink-muted">{doneCount} of {steps.length} done</span>
        <div className="h-1.5 w-24 rounded-full bg-line-soft overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <div className="flex-1" />
        <button onClick={hide} aria-label="Hide Get started" title="Hide" className="text-ink-muted hover:text-ink-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="mt-1.5 divide-y divide-line-soft">
        {remaining.map((s) => (
          <li key={s.label} className="flex items-center gap-3 py-2">
            <div className="flex-1 min-w-0 text-sm">
              <span className="font-semibold text-ink-primary">{s.label}</span>
              <span className="hidden sm:inline text-xs text-ink-muted"> · {s.hint}</span>
            </div>
            <button onClick={() => skip(s.label)} className="text-xs text-ink-muted hover:text-ink-primary shrink-0">
              Skip
            </button>
            <Link href={s.href} className="text-sm font-semibold text-brand shrink-0">
              {s.cta}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
