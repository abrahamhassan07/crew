"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ChevronLeft, Download, Info, Pencil, Plus, Send, Sprout, Trash2, Wallet } from "lucide-react";
import { checkCanSendDocuments, emailInvoice, getEmailDraft, recordPayment, saveInvoice, updateInvoiceStatus, type InvoiceInput, type InvoiceLineInput, type PaymentInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ClientPicker, NEW_CLIENT, TextField, SelectField, TextAreaField } from "@/components/forms";
import { SendEmailModal } from "@/components/SendEmailModal";
import { DecimalInput } from "@/components/forms/DecimalInput";
import { DEFAULT_REFERENCE_TEMPLATE, renderReference } from "@/lib/invoiceNumbers";
import { syncInvoiceToXero } from "@/app/(app)/xeroActions";
import type { EmailDraft } from "@/lib/emailTemplates";
import { ToastBanner, useToast } from "@/components/Toast";
import { calcTotals } from "@/lib/gst";
import { logoUrl } from "@/lib/logo";
import { daysFromToday, fmtDateLabel, todayISO } from "@/lib/design";
import type { Client, GstMode, Invoice, InvoiceItem, InvoiceStatus, Organization, Payment, Property, Service } from "@/lib/supabase/types";

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
  organization,
  startInEdit = false,
  xeroConnected = false,
  suggestedNum = "",
  prefill,
}: {
  invoice: Invoice | null;
  items: InvoiceItem[];
  payments: Payment[];
  clients: Client[];
  properties: Property[];
  services: Service[];
  jobs?: JobOption[];
  organization: Organization | null;
  startInEdit?: boolean;
  /** The business has connected Xero: show the sync controls. */
  xeroConnected?: boolean;
  /** The number a new invoice will get (shown, and editable, on the form). */
  suggestedNum?: string;
  /** A new invoice started from a completed job: client, address, job reference and a line item. */
  prefill?: { clientId: string; propertyId: string; jobId: string; lines: InvoiceLineInput[] };
}) {
  const BIZ = {
    name: organization?.name ?? "Your business",
    abn: organization?.abn ?? "—",
    addr: organization?.address ?? "—",
    phone: organization?.phone ?? "—",
    email: organization?.email ?? "—",
  };
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<PaymentInput | null>(null);
  const [isEditing, setIsEditing] = useState(!invoice || invoice.status === "Draft" || startInEdit);

  const [clientId, setClientId] = useState(invoice?.client_id ?? prefill?.clientId ?? "");
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", address: "" });
  const [propertyId, setPropertyId] = useState(invoice?.property_id ?? prefill?.propertyId ?? "");
  const [jobId, setJobId] = useState(invoice?.job_id ?? prefill?.jobId ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? todayISO());
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? daysFromToday(14));
  const gstRegistered = organization?.gst_registered ?? true;
  const [mode, setMode] = useState<GstMode>(invoice?.mode ?? (gstRegistered ? "exclusive" : "none"));
  const [notes, setNotes] = useState(invoice?.notes ?? (organization?.payment_details?.trim() || "Please use the invoice number as your payment reference."));
  const [num, setNum] = useState(invoice?.num ?? suggestedNum);
  // null = not edited yet, so the reference follows the default pattern as the job and client are chosen.
  const [refText, setRefText] = useState<string | null>(invoice?.reference ?? null);
  const [serviceNotes, setServiceNotes] = useState(invoice?.service_notes ?? "");
  const [showNotes, setShowNotes] = useState(!!invoice?.service_notes);
  const [lines, setLines] = useState<InvoiceLineInput[]>(
    initialItems.length
      ? initialItems.map((i) => ({ serviceId: i.service_id, serviceName: i.service_name, description: i.description, qty: i.qty, unitPrice: i.unit_price }))
      : prefill?.lines.length
        ? prefill.lines
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

  const defaultReference = renderReference(organization?.invoice_reference_template ?? DEFAULT_REFERENCE_TEMPLATE, {
    job_number: jobs.find((j) => j.id === jobId)?.num ?? "",
    client_name: (isNewClient ? newClient.name : clients.find((c) => c.id === clientId)?.name) ?? "",
    service_address: property ? `${property.street}, ${property.suburb}` : isNewClient ? newClient.address : (clients.find((c) => c.id === clientId)?.address ?? ""),
  });
  const reference = refText ?? defaultReference;
  const numberLocked = !!invoice && invoice.status !== "Draft";

  const input: InvoiceInput = { clientId, newClient: isNewClient ? newClient : null, propertyId: propertyId || null, jobId: jobId || null, issueDate, dueDate, mode, notes, serviceNotes, num: numberLocked ? undefined : num, reference, items: lines };

  const commitDraft = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveInvoice(invoice?.id ?? null, input, "Draft");
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

  // The "Review email" step. markSent: the invoice is still a draft and becomes Sent once the email goes out.
  const [review, setReview] = useState<{ id: string; num: string; draft: EmailDraft; markSent: boolean; fromEditor: boolean } | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const openReview = async (id: string, num: string, markSent: boolean, fromEditor: boolean) => {
    const loaded = await getEmailDraft("invoice", id);
    if (!loaded.ok || !loaded.draft) return loaded.error ?? "Could not prepare the email.";
    setReviewError(null);
    setReview({ id, num, draft: loaded.draft, markSent, fromEditor });
    return null;
  };

  // Edit-mode "Send": save first (as a draft until the email actually goes), then review.
  const startSend = () => {
    setError(null);
    startTransition(async () => {
      const ready = await checkCanSendDocuments();
      if (!ready.ok) {
        setError(ready.error ?? "Can't send yet.");
        return;
      }
      const alreadySent = !!invoice && invoice.status !== "Draft";
      const result = await saveInvoice(invoice?.id ?? null, input, alreadySent ? invoice!.status : "Draft");
      if (!result.ok) {
        setError(result.error ?? "Could not save invoice.");
        return;
      }
      const problem = await openReview(result.id!, invoice?.num ?? "Invoice", !alreadySent, true);
      if (problem) {
        setError(problem);
        if (!invoice) router.push(`/invoices/${result.id}`);
      }
    });
  };

  // View-mode Send (markSent) and Resend.
  const sendByEmail = (markSent: boolean) => {
    if (!invoice) return;
    startTransition(async () => {
      const ready = await checkCanSendDocuments();
      if (!ready.ok) {
        showToast(ready.error ?? "Can't send yet.");
        return;
      }
      const problem = await openReview(invoice.id, invoice.num, markSent, false);
      if (problem) showToast(problem);
    });
  };

  const sendReviewed = (subject: string, body: string) => {
    if (!review) return;
    setReviewError(null);
    startTransition(async () => {
      if (review.markSent) {
        const marked = await updateInvoiceStatus(review.id, "Sent");
        if (!marked.ok) {
          setReviewError(marked.error ?? "Could not update the invoice.");
          return;
        }
      }
      const sent = await emailInvoice(review.id, { subject, body });
      if (!sent.ok) {
        if (review.markSent) await updateInvoiceStatus(review.id, "Draft");
        setReviewError(sent.error ?? "Could not send the email.");
        return;
      }
      const { id, num, fromEditor } = review;
      setReview(null);
      showToast(`${num} emailed to ${sent.sentTo}`);
      if (fromEditor) router.push(`/invoices/${id}`);
      router.refresh();
    });
  };

  const cancelReview = () => {
    const id = review?.id;
    const fromEditor = review?.fromEditor;
    setReview(null);
    // A brand-new invoice was already saved as a draft; show it rather than leave an unsaved form open.
    if (fromEditor && !invoice && id) router.push(`/invoices/${id}`);
  };

  const reviewModal = review && (
    <SendEmailModal draft={review.draft} confirmLabel="Send email" pending={pending} error={reviewError} onSend={sendReviewed} onCancel={cancelReview} />
  );

  const sendToXero = () => {
    if (!invoice) return;
    startTransition(async () => {
      const result = await syncInvoiceToXero(invoice.id);
      showToast(result.ok ? `${invoice.num} sent to Xero` : result.error ?? "Couldn't send to Xero.");
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
                {invoice.xero_invoice_id && (
                  <a
                    href={`https://go.xero.com/app/invoicing/view/${invoice.xero_invoice_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand hover:text-brand-hover"
                  >
                    In Xero ↗
                  </a>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="md" type="button">
                    <Download className="w-4 h-4" />
                    Download PDF
                  </Button>
                </a>
                {xeroConnected && invoice.status !== "Draft" && (invoice.status !== "Voided" || invoice.xero_invoice_id) && (
                  <Button variant="secondary" size="md" onClick={sendToXero} disabled={pending}>
                    {invoice.xero_invoice_id ? "Resync to Xero" : "Send to Xero"}
                  </Button>
                )}
                {invoice.status === "Draft" && (
                  <>
                    <Button variant="secondary" size="md" onClick={() => setIsEditing(true)}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button variant="primary" size="md" onClick={() => sendByEmail(true)} disabled={pending}>
                      <Send className="w-4 h-4" />
                      Send
                    </Button>
                  </>
                )}
                {["Sent", "Overdue", "Partially Paid"].includes(invoice.status) && (
                  <>
                    <Button variant="secondary" size="md" onClick={() => sendByEmail(false)} disabled={pending}>
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
                      onClick={() => setPayModal({ amount: balance, paidDate: todayISO(), method: "Bank transfer (EFT)", reference: "" })}
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
            {xeroConnected && invoice.xero_error && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-danger-tint border border-danger-border rounded-lg text-sm text-danger-text mb-6">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  This invoice isn&rsquo;t in Xero yet: {invoice.xero_error} Fix that in Xero or here, then use &ldquo;{invoice.xero_invoice_id ? "Resync to Xero" : "Send to Xero"}&rdquo;.
                </span>
              </div>
            )}
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
                    {logoUrl(organization?.logo_path) ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from storage */}
                        <img src={logoUrl(organization?.logo_path)!} alt={`${BIZ.name} logo`} className="max-h-14 max-w-[200px] object-contain mb-2" />
                        <span className="text-lg font-extrabold">{BIZ.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-forest flex items-center justify-center">
                          <Sprout className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-extrabold">{BIZ.name}</span>
                      </div>
                    )}
                    <div className="text-xs text-ink-muted mt-2.5 leading-relaxed">
                      ABN {BIZ.abn}
                      <br />
                      {BIZ.addr}
                      <br />
                      {BIZ.phone} · {BIZ.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-forest">{invoice.mode === "none" ? "Invoice" : "Tax Invoice"}</div>
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
                      {invoice.reference && (
                        <>
                          <br />
                          Ref: {invoice.reference}
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

                {invoice.service_notes && (
                  <div className="mt-5 text-sm leading-relaxed">
                    <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-1">Notes</div>
                    <div className="whitespace-pre-wrap">{invoice.service_notes}</div>
                  </div>
                )}

                <div className="ml-auto mt-4 w-full sm:w-72 text-sm">
                  {invoice.mode !== "none" && (
                    <>
                      <div className="flex justify-between py-1"><span>Subtotal</span><span>${totals.sub.toFixed(2)}</span></div>
                      <div className="flex justify-between py-1"><span>GST (10%)</span><span>${totals.gst.toFixed(2)}</span></div>
                    </>
                  )}
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
        {reviewModal}
        <ToastBanner message={toast} />
      </div>
    );
  }

  // ---------------------------------------------------------------- EDIT ---
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-5 border-b border-line bg-card-bg">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-2">
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
          <h1 className="text-2xl font-bold text-ink-primary">{invoice ? `Edit ${invoice.num}` : "New invoice"}</h1>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button variant="secondary" onClick={commitDraft} disabled={pending}>Save draft</Button>
            <Button variant="primary" onClick={startSend} disabled={pending}>Send</Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-[3] w-full min-w-0 flex flex-col gap-5">
            <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-x-4 gap-y-3.5 [&>*]:lg:col-span-2">
              <ClientPicker
                required
                clients={clients}
                value={isNewClient ? NEW_CLIENT : clientId}
                allowNew={!invoice}
                onChange={(v) => {
                  setIsNewClient(v === NEW_CLIENT);
                  setClientId(v === NEW_CLIENT ? "" : v);
                  setPropertyId("");
                  setJobId("");
                }}
              />
              {isNewClient ? (
                <div className="flex items-end text-xs text-ink-muted pb-2">They&rsquo;ll be added to your Clients list as a Lead when you save.</div>
              ) : (
                <SelectField
                  label="Linked job"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  options={clientJobs.map((j) => ({ value: j.id, label: `${j.num} · ${j.title || j.job_type}${j.job_date ? ` · ${fmtDateLabel(j.job_date)}` : ""}` }))}
                  placeholder="No job"
                />
              )}
              {isNewClient && (
                <>
                  <TextField label="Client name" required value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                  <TextField label="Email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                  <TextField label="Phone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                  <TextField label="Address" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
                </>
              )}
              {!isNewClient && (
                <SelectField
                  label="Service address"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  options={clientProperties.map((p) => ({ value: p.id, label: `${p.street}, ${p.suburb}` }))}
                  placeholder="No property selected"
                />
              )}
              <div className="lg:col-span-3!">
                <TextField label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="lg:col-span-3!">
                <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="lg:col-span-2!">
                <TextField
                  label="Invoice number"
                  value={num}
                  maxLength={40}
                  disabled={numberLocked}
                  onChange={(e) => setNum(e.target.value)}
                  help={xeroConnected ? "Used in Xero too. Set your prefix and next number in Settings." : "Set your prefix and next number in Settings."}
                />
              </div>
              <div className="lg:col-span-4!">
                <TextField
                  label="Reference (optional)"
                  value={reference}
                  maxLength={255}
                  onChange={(e) => setRefText(e.target.value)}
                  placeholder="e.g. PO number or job number"
                  help={xeroConnected ? "Shown on the invoice and sent to Xero as its Reference." : "Shown on the invoice."}
                />
              </div>
            </Card>

            <Card className="p-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="text-base font-bold text-ink-primary">Line items</h2>
                {gstRegistered && (
                  <div className="flex bg-neutral-bg rounded-lg p-0.5">
                    {(["exclusive", "inclusive"] as GstMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={mode === m ? { background: "#fff" } : {}}>
                        {m === "exclusive" ? "GST exclusive" : "GST inclusive"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="hidden sm:grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted -mb-1">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-start border-b border-line-soft pb-3">
                    <div className="flex flex-col gap-1.5">
                      <input value={l.serviceName} onChange={(e) => setLine(i, { ...l, serviceName: e.target.value })} placeholder="Item name" className="w-full h-9 border border-field-border rounded-md px-2.5 text-sm font-semibold" />
                      <input value={l.description} onChange={(e) => setLine(i, { ...l, description: e.target.value })} placeholder="Description" className="w-full h-8 border border-field-border rounded-md px-2.5 text-xs" />
                    </div>
                    <div>
                      <span className="sm:hidden text-[11px] font-semibold text-ink-muted">Qty</span>
                      <DecimalInput label="Quantity" value={l.qty} onValue={(qty) => setLine(i, { ...l, qty })} decimals={2} />
                    </div>
                    <div>
                      <span className="sm:hidden text-[11px] font-semibold text-ink-muted">Price</span>
                      <DecimalInput label="Unit price" prefix="$" value={l.unitPrice} onValue={(unitPrice) => setLine(i, { ...l, unitPrice })} padOnBlur />
                    </div>
                    <span className="h-9 flex items-center justify-end font-semibold text-sm">${(l.qty * l.unitPrice).toFixed(2)}</span>
                    <button onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [blankLine()])} className="h-9 flex items-center justify-center text-ink-muted">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setLines([...lines, blankLine()])} className="text-sm font-semibold text-brand flex items-center gap-1.5 self-start">
                  <Plus className="w-4 h-4" /> Add line item
                </button>
                {showNotes ? (
                  <TextAreaField label="Notes (optional)" rows={3} maxLength={2000} value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} placeholder="e.g. what was done, access details, anything the client should know. Shown on the invoice." />
                ) : (
                  <button onClick={() => setShowNotes(true)} className="text-sm font-semibold text-brand flex items-center gap-1.5 self-start">
                    <Plus className="w-4 h-4" /> Add notes
                  </button>
                )}
              </div>
            </Card>

          </div>

          <div className="flex-[1.2] w-full min-w-0 flex flex-col gap-5 lg:sticky lg:top-4">
          <Card className="p-5">
            <h2 className="text-base font-bold mb-3">Summary</h2>
            {mode !== "none" && (
              <>
                <div className="flex justify-between text-sm py-1.5"><span className="text-ink-secondary">Subtotal (ex. GST)</span><span className="font-semibold">${totals.sub.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm py-1.5"><span className="text-ink-secondary">GST (10%)</span><span className="font-semibold">${totals.gst.toFixed(2)}</span></div>
              </>
            )}
            <div className="flex justify-between text-base py-2.5 border-t border-line mt-1.5"><span className="font-bold">Total (AUD)</span><span className="font-bold">${totals.total.toFixed(2)}</span></div>
            <div className="text-xs text-ink-muted mt-2">Due {fmtDateLabel(dueDate)}</div>
            {error && <p className="text-sm text-danger mt-3">{error}</p>}
          </Card>
            <Card className="p-5">
              <TextAreaField
                label="Payment instructions"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                help={organization?.payment_details?.trim() ? undefined : "Tip: save your bank details once under Settings > Payment details and they will fill in here automatically."}
              />
            </Card>
          </div>
        </div>
      </div>
      {reviewModal}
      <ToastBanner message={toast} />
    </div>
  );
}
