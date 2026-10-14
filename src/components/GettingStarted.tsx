import Link from "next/link";
import { Check, Circle } from "lucide-react";

export interface GettingStartedProps {
  hasBusinessDetails: boolean;
  hasPaymentDetails: boolean;
  hasClient: boolean;
  hasQuote: boolean;
  hasInvoice: boolean;
}

export function GettingStarted(p: GettingStartedProps) {
  const steps = [
    { done: p.hasBusinessDetails, label: "Add your business details", hint: "Email and phone appear on quotes and invoices, and clients reply to your email.", href: "/settings", cta: "Open settings" },
    { done: p.hasPaymentDetails, label: "Add your payment details", hint: "Bank or PayID details that fill in on every new invoice.", href: "/settings", cta: "Open settings" },
    { done: p.hasClient, label: "Add your first client", hint: "Or just pick “New client” when you create a quote or job.", href: "/clients/new", cta: "New client" },
    { done: p.hasQuote, label: "Send your first quote", hint: "It's emailed to the client as a PDF.", href: "/quotes/new", cta: "New quote" },
    { done: p.hasInvoice, label: "Create your first invoice", hint: "Record payments against it as they come in.", href: "/invoices/new", cta: "New invoice" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="bg-card-bg border border-line rounded-lg p-5 mb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-bold text-ink-primary">Get started</h2>
          <div className="text-xs text-ink-muted">{doneCount} of {steps.length} done</div>
        </div>
        <div className="h-1.5 w-32 rounded-full bg-line-soft overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-line-soft">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 py-2.5">
            {s.done ? <Check className="w-4 h-4 text-ok-fg shrink-0" /> : <Circle className="w-4 h-4 text-ink-muted shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${s.done ? "text-ink-muted line-through" : "text-ink-primary"}`}>{s.label}</div>
              {!s.done && <div className="text-xs text-ink-muted">{s.hint}</div>}
            </div>
            {!s.done && (
              <Link href={s.href} className="text-sm font-semibold text-brand shrink-0">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
