"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { recordPayment, saveInvoice, updateInvoiceStatus, type InvoiceInput, type InvoiceLineInput, type PaymentInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField, SelectField, TextAreaField } from "@/components/forms";
import { calcTotals } from "@/lib/gst";
import type { Client, GstMode, Invoice, InvoiceItem, Payment, Property, Service } from "@/lib/supabase/types";

function blankLine(): InvoiceLineInput {
  return { serviceId: null, serviceName: "", description: "", qty: 1, unitPrice: 0 };
}

export function InvoiceEditor({
  invoice,
  items: initialItems,
  payments,
  clients,
  properties,
  services,
}: {
  invoice: Invoice | null;
  items: InvoiceItem[];
  payments: Payment[];
  clients: Client[];
  properties: Property[];
  services: Service[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<PaymentInput | null>(null);

  const [clientId, setClientId] = useState(invoice?.client_id ?? "");
  const [propertyId, setPropertyId] = useState(invoice?.property_id ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  const [mode, setMode] = useState<GstMode>(invoice?.mode ?? "exclusive");
  const [notes, setNotes] = useState(invoice?.notes ?? "Payment by EFT to BSB 063-000, Acc 1234 5678. Please use the invoice number as reference.");
  const [lines, setLines] = useState<InvoiceLineInput[]>(
    initialItems.length
      ? initialItems.map((i) => ({ serviceId: i.service_id, serviceName: i.service_name, description: i.description, qty: i.qty, unitPrice: i.unit_price }))
      : [blankLine()]
  );

  const locked = invoice ? invoice.status !== "Draft" : false;
  const clientProperties = properties.filter((p) => p.client_id === clientId);
  const totals = calcTotals(lines.map((l) => ({ qty: l.qty, unit_price: l.unitPrice })), mode);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, totals.total - paid);

  const input: InvoiceInput = { clientId, propertyId: propertyId || null, jobId: invoice?.job_id ?? null, issueDate, dueDate, mode, notes, items: lines };

  const commit = (status: "Draft" | "Sent") => {
    setError(null);
    startTransition(async () => {
      const result = await saveInvoice(invoice?.id ?? null, input, status);
      if (!result.ok) {
        setError(result.error ?? "Could not save invoice.");
        return;
      }
      router.push(`/invoices/${result.id}`);
      router.refresh();
    });
  };

  const setStatus = (status: "Voided") => {
    if (!invoice) return;
    startTransition(async () => {
      await updateInvoiceStatus(invoice.id, status);
      router.refresh();
    });
  };

  const savePayment = () => {
    if (!invoice || !payModal) return;
    setError(null);
    startTransition(async () => {
      const result = await recordPayment(invoice.id, payModal);
      if (!result.ok) {
        setError(result.error ?? "Could not record payment.");
        return;
      }
      setPayModal(null);
      router.refresh();
    });
  };

  const setLine = (i: number, next: InvoiceLineInput) => setLines(lines.map((l, k) => (k === i ? next : l)));

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-primary">{invoice ? invoice.num : "New invoice"}</h1>
            {invoice && <StatusBadge status={invoice.status.toLowerCase().replace(" ", "-") as "draft" | "sent" | "partially-paid" | "paid" | "overdue" | "voided"} label={invoice.status} showDot />}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(!invoice || invoice.status === "Draft") && (
              <>
                <Button variant="secondary" onClick={() => commit("Draft")} disabled={pending}>Save draft</Button>
                <Button variant="primary" onClick={() => commit("Sent")} disabled={pending}>Send</Button>
              </>
            )}
            {invoice && ["Sent", "Partially Paid", "Overdue"].includes(invoice.status) && (
              <>
                <Button variant="secondary" onClick={() => setStatus("Voided")} disabled={pending}>Void</Button>
                <Button variant="primary" onClick={() => setPayModal({ amount: balance, paidDate: new Date().toISOString().slice(0, 10), method: "Bank transfer (EFT)", reference: "" })} disabled={pending}>
                  Record payment
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-[2] w-full flex flex-col gap-6">
            <Card className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Client" required disabled={locked} value={clientId} onChange={(e) => { setClientId(e.target.value); setPropertyId(""); }} options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select a client" />
              <SelectField label="Service address" disabled={locked} value={propertyId} onChange={(e) => setPropertyId(e.target.value)} options={clientProperties.map((p) => ({ value: p.id, label: `${p.street}, ${p.suburb}` }))} placeholder="No property selected" />
              <TextField label="Issue date" type="date" disabled={locked} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              <TextField label="Due date" type="date" disabled={locked} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Card>

            <Card className="p-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="text-base font-bold text-ink-primary">Line items</h2>
                <div className="flex bg-neutral-bg rounded-lg p-0.5">
                  {(["exclusive", "inclusive"] as GstMode[]).map((m) => (
                    <button key={m} disabled={locked} onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={mode === m ? { background: "#fff" } : {}}>
                      {m === "exclusive" ? "GST exclusive" : "GST inclusive"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_70px_90px_90px_32px] gap-2 items-start border-b border-line-soft pb-3">
                    <div className="flex flex-col gap-1.5">
                      <input disabled={locked} value={l.serviceName} onChange={(e) => setLine(i, { ...l, serviceName: e.target.value })} placeholder="Item name" className="h-9 border border-field-border rounded-md px-2.5 text-sm font-semibold" />
                      <input disabled={locked} value={l.description} onChange={(e) => setLine(i, { ...l, description: e.target.value })} placeholder="Description" className="h-8 border border-field-border rounded-md px-2.5 text-xs" />
                    </div>
                    <input disabled={locked} type="number" min={0} step={0.5} value={l.qty} onChange={(e) => setLine(i, { ...l, qty: Number(e.target.value) })} className="h-9 border border-field-border rounded-md px-2 text-sm" />
                    <input disabled={locked} type="number" min={0} step={0.01} value={l.unitPrice} onChange={(e) => setLine(i, { ...l, unitPrice: Number(e.target.value) })} className="h-9 border border-field-border rounded-md px-2 text-sm" />
                    <span className="h-9 flex items-center justify-end font-semibold text-sm">${(l.qty * l.unitPrice).toFixed(2)}</span>
                    {!locked && (
                      <button onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [blankLine()])} className="h-9 flex items-center justify-center text-ink-muted">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <button onClick={() => setLines([...lines, blankLine()])} className="text-sm font-semibold text-brand flex items-center gap-1.5 self-start">
                    <Plus className="w-4 h-4" /> Add line item
                  </button>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <TextAreaField label="Payment instructions" disabled={locked} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Card>

            {invoice && payments.length > 0 && (
              <Card className="p-5">
                <h2 className="text-base font-bold mb-3">Payments</h2>
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm py-2 border-t border-line-soft">
                    <span><span className="font-semibold">${p.amount.toFixed(2)}</span> <span className="text-ink-muted">· {p.method} · {p.reference}</span></span>
                    <span className="text-ink-muted">{p.paid_date}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <Card className="p-6 flex-1 w-full lg:sticky lg:top-4">
            <h2 className="text-base font-bold mb-3">Summary</h2>
            <div className="flex justify-between text-sm py-1.5"><span className="text-ink-secondary">Subtotal (ex. GST)</span><span className="font-semibold">${totals.sub.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-ink-secondary">GST (10%)</span><span className="font-semibold">${totals.gst.toFixed(2)}</span></div>
            <div className="flex justify-between text-base py-2.5 border-t border-line mt-1.5"><span className="font-bold">Total (AUD)</span><span className="font-bold">${totals.total.toFixed(2)}</span></div>
            {invoice && (
              <>
                <div className="flex justify-between text-sm py-1.5" style={{ color: "var(--ok-fg)" }}><span>Amount paid</span><span>− ${paid.toFixed(2)}</span></div>
                <div className="flex justify-between text-base py-2.5 border-t border-line font-bold"><span>Balance due</span><span>${balance.toFixed(2)}</span></div>
              </>
            )}
            {error && <p className="text-sm text-danger mt-3">{error}</p>}
          </Card>
        </div>
      </div>

      {payModal && (
        <>
          <div onClick={() => setPayModal(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-sm p-5">
              <h2 className="text-lg font-bold mb-3">Record payment</h2>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Amount (AUD)" type="number" min={0} step={0.01} value={payModal.amount} onChange={(e) => setPayModal({ ...payModal, amount: Number(e.target.value) })} />
                <TextField label="Date paid" type="date" value={payModal.paidDate} onChange={(e) => setPayModal({ ...payModal, paidDate: e.target.value })} />
                <div className="col-span-2">
                  <SelectField label="Method" value={payModal.method} onChange={(e) => setPayModal({ ...payModal, method: e.target.value })} options={["Bank transfer (EFT)", "Cash", "Cheque", "Card (processed externally)"].map((m) => ({ value: m, label: m }))} />
                </div>
                <div className="col-span-2">
                  <TextField label="Reference" value={payModal.reference} onChange={(e) => setPayModal({ ...payModal, reference: e.target.value })} />
                </div>
              </div>
              {error && <p className="text-sm text-danger mt-3">{error}</p>}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setPayModal(null)}>Cancel</Button>
                <Button variant="primary" onClick={savePayment} disabled={pending}>Record payment</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
