"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ChevronLeft, Download, Info, Pencil, Plus, Send, Sprout, Trash2, Wallet } from "lucide-react";
import { recordPayment, saveInvoice, updateInvoiceStatus, type InvoiceInput, type InvoiceLineInput, type PaymentInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField, SelectField, TextAreaField } from "@/components/forms";
import { ToastBanner, useToast } from "@/components/Toast";
import { calcTotals } from "@/lib/gst";
import { fmtDateLabel } from "@/lib/design";
import type { Client, GstMode, Invoice, InvoiceItem, InvoiceStatus, Payment, Property, Service } from "@/lib/supabase/types";

// No business-profile table exists yet (Settings' Business Information save
// button is a disabled stub) — placeholder branding until that's wired up.
const BIZ = {
  name: "Crew & Grounds",
  abn: "12 345 678 901",
  addr: "PO Box 123, Melbourne VIC 3000",
  phone: "0400 000 000",
  email: "hello@crewandgrounds.com.au",
};

interface JobOption {
  id: string;
  num: string;
  title: string;
  job_type: string;
  client_id: string | null;
  job_date: string | null;
}

function blankLine(): InvoiceLineInput {
  return { serviceId: null, serviceName: "", description: "", qty: 1, unitPrice: 0 };
}

function badgeStatusKey(s: InvoiceStatus) {
  return s.toLowerCase().replace(" ", "-") as "draft" | "sent" | "partially-paid" | "paid" | "overdue" | "voided";
}

export function InvoiceEditor({
  invoice,
  items: initialItems,
  payments,
  clients,
  properties,
  services,
  jobs = [],
  startInEdit = false,
}: {
  invoice: Invoice | null;
  items: InvoiceItem[];
  payments: Payment[];
  clients: Client[];
  properties: Property[];
  services: Service[];
  jobs?: JobOption[];
  startInEdit?: boolean;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<PaymentInput | null>(null);
  const [isEditing, setIsEditing] = useState(!invoice || invoice.status === "Draft" || startInEdit);

  const [clientId, setClientId] = useState(invoice?.client_id ?? "");
  const [propertyId, setPropertyId] = useState(invoice?.property_id ?? "");
  const [jobId, setJobId] = useState(invoice?.job_id ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  const [mode, setMode] = useState<GstMode>(invoice?.mode ?? "exclusive");
  const [notes, setNotes] = useState(invoice?.notes ?? "Payment by EFT to BSB 063-000, Acc 1234 5678. Please use the invoice number as reference.");
  const [lines, setLines] = useState<InvoiceLineInput[]>(
    initialItems.length
      ? initialItems.map((i) => ({ serviceId: i.service_id, serviceName: i.service_name, description: i.description, qty: i.qty, unitPrice: i.unit_price }))
      : [blankLine()]
  );

  const client = clients.find((c) => c.id === (invoice?.client_id ?? clientId));
  const clientProperties = properties.filter((p) => p.client_id === clientId);
  const clientJobs = jobs.filter((j) => j.client_id === clientId);
  const property = properties.find((p) => p.id === (invoice?.property_id ?? propertyId));
  const job = jobs.find((j) => j.id === (invoice?.job_id ?? jobId));
  const totals = calcTotals(lines.map((l) => ({ qty: l.qty, unit_price: l.unitPrice })), mode);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, totals.total - paid);
  const overdue = invoice?.status === "Overdue";

  const input: InvoiceInput = { clientId, propertyId: propertyId || null, jobId: jobId || null, issueDate, dueDate, mode, notes, items: lines };

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

  const setStatus = (status: InvoiceStatus, message: string) => {
    if (!invoice) return;
    startTransition(async () => {
      await updateInvoiceStatus(invoice.id, status);
      showToast(message);
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
      showToast(`$${payModal.amount.toFixed(2)} payment recorded on ${invoice.num}`);
      router.refresh();
    });
  };

  const setLine = (i: number, next: InvoiceLineInput) => setLines(lines.map((l, k) => (k === i ? next : l)));

  // ---------------------------------------------------------------- VIEW ---
  if (invoice && !isEditing) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="px-6 py-8 border-b border-line bg-card-bg">
          <div className="max-w-5xl mx-auto">
            <Link href="/invoices" className="text-sm font-semibold text-brand hover:text-brand-hover mb-3 inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Invoices
            </Link>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-ink-primary">{invoice.num}</h1>
                <StatusBadge status={badgeStatusKey(invoice.status)} label={invoice.status} showDot />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="md" onClick={() => showToast("PDF generation is not connected in this prototype")}>
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                {invoice.status === "Draft" && (
                  <>
                    <Button variant="secondary" size="md" onClick={() => setIsEditing(true)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button variant="primary" size="md" onClick={() => setStatus("Sent", `${invoice.num} marked as sent.`)} disabled={pending}>
                      <Send className="w-4 h-4" />
                      Send
                    </Button>
                  </>
                )}
                {["Sent", "Overdue", "Partially Paid"].includes(invoice.status) && (
                  <>
                    <Button variant="secondary" size="md" onClick={() => showToast(`${invoice.num} resend simulated — no email was sent`)}>
                      <Send className="w-4 h-4" />
                      Resend
                    </Button>
                    <Button variant="secondary" size="md" onClick={() => setStatus("Voided", `${invoice.num} voided`)} disabled={pending}>
                      <Ban className="w-4 h-4" />
                      Void
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setPayModal({ amount: balance, paidDate: new Date().toISOString().slice(0, 10), method: "Bank transfer (EFT)", reference: "" })}
                    >
                      <Wallet className="w-4 h-4" />
                      Record payment
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-start gap-2.5 px-4 py-3 bg-warn-bg border border-warn-fg/25 rounded-lg text-sm text-warn-fg mb-6">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Online card payments aren&rsquo;t connected. Payments recorded here are manual entries (EFT, cash, cheque). Connect a payment provider in Settings before
                offering online payment.
              </span>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 items-start">
              <Card className="flex-[2] w-full p-6 sm:p-10">
                <div className="flex flex-wrap justify-between gap-5 mb-7">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-forest flex items-center justify-center">
                        <Sprout className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-lg font-extrabold">{BIZ.name}</span>
                    </div>
                    <div className="text-xs text-ink-muted mt-2.5 leading-relaxed">
                      ABN {BIZ.abn}
                      <br />
                      {BIZ.addr}
                      <br />
                      {BIZ.phone} · {BIZ.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-forest">Tax Invoice</div>
                    <div className="text-sm text-ink-secondary mt-1.5 leading-relaxed">
                      {invoice.num}
                      <br />
                      Issued: {fmtDateLabel(invoice.issue_date)}
                      <br />
                      Due: {fmtDateLabel(invoice.due_date)}
                      {job && (
                        <>
                          <br />
                          Job: {job.num}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-10 mb-6 text-sm leading-relaxed">
                  <div>
                    <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-1">Bill to</div>
                    <strong>{client?.name ?? "—"}</strong>
                    <br />
                    {client?.address ?? "—"}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-1">Service address</div>
                    {property ? `${property.street}, ${property.suburb} ${property.state} ${property.postcode}` : client?.address ?? "—"}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm min-w-[420px]">
                    <thead>
                      <tr>
                        <th className="text-left py-2 border-b-2 border-ink-primary">Item</th>
                        <th className="text-right py-2 border-b-2 border-ink-primary w-16">Qty</th>
                        <th className="text-right py-2 border-b-2 border-ink-primary w-24">Unit</th>
                        <th className="text-right py-2 border-b-2 border-ink-primary w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialItems.map((i) => (
                        <tr key={i.id}>
                          <td className="py-2.5 border-b border-line align-top">
                            <strong>{i.service_name}</strong>
                            {i.description && <div className="text-ink-muted text-xs mt-0.5">{i.description}</div>}
                          </td>
                          <td className="py-2.5 border-b border-line text-right align-top">{i.qty}</td>
                          <td className="py-2.5 border-b border-line text-right align-top">${i.unit_price.toFixed(2)}</td>
                          <td className="py-2.5 border-b border-line text-right align-top">${(i.qty * i.unit_price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto mt-4 w-full sm:w-72 text-sm">
                  <div className="flex justify-between py-1"><span>Subtotal</span><span>${totals.sub.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span>GST (10%)</span><span>${totals.gst.toFixed(2)}</span></div>
                  <div className="flex justify-between py-2 border-t-2 border-ink-primary mt-1 text-base font-extrabold"><span>Total AUD</span><span>${totals.total.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1 text-ok-fg"><span>Amount paid</span><span>− ${paid.toFixed(2)}</span></div>
                  <div className="flex justify-between py-2 border-t border-line text-base font-extrabold"><span>Balance due</span><span>${balance.toFixed(2)}</span></div>
                </div>

                {notes && <div className="text-xs text-ink-muted leading-relaxed mt-6 whitespace-pre-wrap">{notes}</div>}
              </Card>

              <aside className="flex-1 w-full flex flex-col gap-4">
                <Card className="p-4">
                  <div className="text-xs font-semibold text-ink-muted">Balance due</div>
                  <div className="text-3xl font-extrabold mt-1" style={{ color: overdue ? "var(--bad-fg)" : "var(--color-ink-primary)" }}>
                    ${balance.toFixed(2)}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {invoice.status === "Voided" ? "This invoice was voided" : balance <= 0 ? "Paid in full" : overdue ? `Overdue since ${fmtDateLabel(invoice.due_date)}` : `Due ${fmtDateLabel(invoice.due_date)}`}
                  </div>
                  <div className="h-1.5 rounded-full bg-line-soft mt-3.5 overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${totals.total ? Math.min(100, (paid / totals.total) * 100) : 0}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-ink-muted mt-1.5">
                    <span>${paid.toFixed(2)} paid</span>
                    <span>of ${totals.total.toFixed(2)}</span>
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-sm font-bold mb-1">Payments</h2>
                  {payments.map((p) => (
                    <div key={p.id} className="flex justify-between gap-2.5 py-2.5 border-t border-line-soft text-sm">
                      <span>
                        <span className="block font-semibold">${p.amount.toFixed(2)}</span>
                        <span className="block text-xs text-ink-muted">{p.method} · {p.reference}</span>
                      </span>
                      <span className="text-ink-muted">{fmtDateLabel(p.paid_date)}</span>
                    </div>
                  ))}
                  {!payments.length && <div className="text-sm text-ink-muted py-1">No payments recorded.</div>}
                </Card>

                <Card className="p-4 text-sm leading-relaxed">
                  <h2 className="text-sm font-bold mb-1.5">Client</h2>
                  {client && (
                    <Link href={`/clients/${client.id}`} className="text-brand hover:text-brand-hover font-bold">
                      {client.name}
                    </Link>
                  )}
                  <div>{client?.email}</div>
                  <div>{client?.phone}</div>
                </Card>
              </aside>
            </div>
          </div>
        </div>

        {payModal && (
          <>
            <div onClick={() => setPayModal(null)} className="fixed inset-0 bg-black/45 z-100" />
            <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
              <div className="bg-card-bg rounded-xl w-full max-w-sm p-5">
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
                <p className="text-xs text-ink-muted mt-3">This records a payment you&rsquo;ve already received. No money is collected.</p>
                {error && <p className="text-sm text-danger mt-2">{error}</p>}
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="secondary" onClick={() => setPayModal(null)}>Cancel</Button>
                  <Button variant="primary" onClick={savePayment} disabled={pending}>Record payment</Button>
                </div>
              </div>
            </div>
          </>
        )}
        <ToastBanner message={toast} />
      </div>
    );
  }

  // ---------------------------------------------------------------- EDIT ---
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {invoice ? (
            <Link href={`/invoices/${invoice.id}`} className="text-sm font-semibold text-brand hover:text-brand-hover inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              {invoice.num}
            </Link>
          ) : (
            <Link href="/invoices" className="text-sm font-semibold text-brand hover:text-brand-hover inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Invoices
            </Link>
          )}
          <h1 className="text-2xl font-bold text-ink-primary w-full">{invoice ? `Edit ${invoice.num}` : "New invoice"}</h1>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button variant="secondary" onClick={() => commit("Draft")} disabled={pending}>Save draft</Button>
            <Button variant="primary" onClick={() => commit("Sent")} disabled={pending}>Send</Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-[2] w-full flex flex-col gap-6">
            <Card className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Client"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPropertyId("");
                  setJobId("");
                }}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select a client"
              />
              <SelectField
                label="Job reference"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                options={clientJobs.map((j) => ({ value: j.id, label: `${j.num} · ${j.title || j.job_type}${j.job_date ? ` · ${fmtDateLabel(j.job_date)}` : ""}` }))}
                placeholder="No job"
              />
              <SelectField
                label="Service address"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                options={clientProperties.map((p) => ({ value: p.id, label: `${p.street}, ${p.suburb}` }))}
                placeholder="No property selected"
              />
              <TextField label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Card>

            <Card className="p-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="text-base font-bold text-ink-primary">Line items</h2>
                <div className="flex bg-neutral-bg rounded-lg p-0.5">
                  {(["exclusive", "inclusive"] as GstMode[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={mode === m ? { background: "#fff" } : {}}>
                      {m === "exclusive" ? "GST exclusive" : "GST inclusive"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_70px_90px_90px_32px] gap-2 items-start border-b border-line-soft pb-3">
                    <div className="flex flex-col gap-1.5">
                      <input value={l.serviceName} onChange={(e) => setLine(i, { ...l, serviceName: e.target.value })} placeholder="Item name" className="h-9 border border-field-border rounded-md px-2.5 text-sm font-semibold" />
                      <input value={l.description} onChange={(e) => setLine(i, { ...l, description: e.target.value })} placeholder="Description" className="h-8 border border-field-border rounded-md px-2.5 text-xs" />
                    </div>
                    <input type="number" min={0} step={0.5} value={l.qty} onChange={(e) => setLine(i, { ...l, qty: Number(e.target.value) })} className="h-9 border border-field-border rounded-md px-2 text-sm" />
                    <input type="number" min={0} step={0.01} value={l.unitPrice} onChange={(e) => setLine(i, { ...l, unitPrice: Number(e.target.value) })} className="h-9 border border-field-border rounded-md px-2 text-sm" />
                    <span className="h-9 flex items-center justify-end font-semibold text-sm">${(l.qty * l.unitPrice).toFixed(2)}</span>
                    <button onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [blankLine()])} className="h-9 flex items-center justify-center text-ink-muted">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setLines([...lines, blankLine()])} className="text-sm font-semibold text-brand flex items-center gap-1.5 self-start">
                  <Plus className="w-4 h-4" /> Add line item
                </button>
              </div>
            </Card>

            <Card className="p-6">
              <TextAreaField label="Payment instructions" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Card>
          </div>

          <Card className="p-6 flex-1 w-full lg:sticky lg:top-4">
            <h2 className="text-base font-bold mb-3">Summary</h2>
            <div className="flex justify-between text-sm py-1.5"><span className="text-ink-secondary">Subtotal (ex. GST)</span><span className="font-semibold">${totals.sub.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-ink-secondary">GST (10%)</span><span className="font-semibold">${totals.gst.toFixed(2)}</span></div>
            <div className="flex justify-between text-base py-2.5 border-t border-line mt-1.5"><span className="font-bold">Total (AUD)</span><span className="font-bold">${totals.total.toFixed(2)}</span></div>
            <div className="text-xs text-ink-muted mt-2">Due {fmtDateLabel(dueDate)}</div>
            {error && <p className="text-sm text-danger mt-3">{error}</p>}
          </Card>
        </div>
      </div>
      <ToastBanner message={toast} />
    </div>
  );
}
