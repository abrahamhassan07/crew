"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { saveInvoiceNumbering } from "@/app/(app)/actions";
import { readXeroNumbering } from "@/app/(app)/xeroActions";
import { DEFAULT_PREFIX, DEFAULT_REFERENCE_TEMPLATE, REFERENCE_PLACEHOLDERS, formatInvoiceNumber } from "@/lib/invoiceNumbers";
import type { Organization } from "@/lib/supabase/types";

/** Settings card: invoice number prefix / next number / digits (to match Xero) and the default invoice reference. */
export function InvoiceNumberingCard({ organization, xeroConnected }: { organization: Organization; xeroConnected: boolean }) {
  const router = useRouter();
  const [prefix, setPrefix] = useState(organization.invoice_prefix ?? DEFAULT_PREFIX);
  const [next, setNext] = useState(organization.invoice_next_number != null ? String(organization.invoice_next_number) : "");
  const [digits, setDigits] = useState(String(organization.invoice_number_digits ?? 1));
  const [template, setTemplate] = useState(organization.invoice_reference_template ?? DEFAULT_REFERENCE_TEMPLATE);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const nextN = /^\d{1,8}$/.test(next.trim()) ? Number(next.trim()) : null;
  const d = Math.min(8, Math.max(1, Number(digits) || 1));
  const preview = nextN != null ? formatInvoiceNumber({ prefix, digits: d }, nextN) : null;

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveInvoiceNumbering({ prefix, nextNumber: next, digits: d, referenceTemplate: template });
      setMessage(res.ok ? { text: "Saved.", ok: true } : { text: res.error ?? "Couldn't save that.", ok: false });
      if (res.ok) router.refresh();
    });
  };

  const matchXero = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await readXeroNumbering();
      if (!res.ok || res.prefix === undefined || res.next === undefined || res.digits === undefined) {
        setMessage({ text: res.error ?? "Couldn't read your numbering from Xero.", ok: false });
        return;
      }
      setPrefix(res.prefix);
      setNext(String(res.next));
      setDigits(String(res.digits));
      setMessage({ text: `Your latest invoice in Xero is ${res.sample}, so the next one here will be ${formatInvoiceNumber({ prefix: res.prefix, digits: res.digits }, res.next)}. Check it, then Save.`, ok: true });
    });
  };

  return (
    <CollapsibleCard
      className="xl:col-span-2"
      title="Invoice numbers and reference"
      summary={
        organization.invoice_next_number != null
          ? `Next invoice: ${formatInvoiceNumber({ prefix: organization.invoice_prefix ?? DEFAULT_PREFIX, digits: organization.invoice_number_digits ?? 1 }, organization.invoice_next_number)}`
          : "Carries on from your last invoice"
      }
    >
      <div className="pt-3 space-y-4">
        <p className="text-sm text-ink-muted">
          Choose how your invoices are numbered so they match the ones in your accounting software. You can still change the number on any draft invoice.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <TextField label="Prefix" value={prefix} maxLength={12} onChange={(e) => setPrefix(e.target.value)} help="Text before the number, e.g. INV-" />
          <TextField label="Next number" inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} placeholder="Carry on" help="The next invoice gets this number. Leave blank to carry on from your last invoice." />
          <TextField label="Minimum digits" inputMode="numeric" value={digits} maxLength={1} onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))} help="4 turns 351 into 0351." />
        </div>
        {preview && (
          <p className="text-sm text-ink-secondary">
            Your next invoice will be numbered <strong className="text-ink-primary">{preview}</strong>.
          </p>
        )}
        {xeroConnected && (
          <div>
            <Button variant="secondary" size="sm" onClick={matchXero} disabled={pending}>Match my Xero numbering</Button>
            <p className="text-xs text-ink-muted mt-1.5">Reads your latest sales invoice number in Xero and fills in the boxes above.</p>
          </div>
        )}

        <div className="max-w-2xl pt-1">
          <TextField
            label="Default reference"
            value={template}
            maxLength={100}
            onChange={(e) => setTemplate(e.target.value)}
            help={`Pre-fills the Reference on each new invoice (you can edit it on the invoice). It's sent to Xero as the invoice's Reference. Available: ${REFERENCE_PLACEHOLDERS.map((p) => `{${p.key}}`).join(", ")}. Leave blank for no default; it stays blank if the invoice has no job or address to fill in.`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          {message && <span className={`text-sm ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</span>}
        </div>
      </div>
    </CollapsibleCard>
  );
}
