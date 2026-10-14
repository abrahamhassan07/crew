"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Send, Trash2 } from "lucide-react";
import { checkCanSendDocuments, convertQuoteToJob, emailQuote, saveQuote, updateQuoteStatus, type QuoteInput, type QuoteLineInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ClientPicker, NEW_CLIENT, TextField, SelectField, TextAreaField } from "@/components/forms";
import { daysFromToday, todayISO } from "@/lib/design";
import { calcTotals } from "@/lib/gst";
import type { Client, GstMode, Property, Quote, QuoteItem, Service } from "@/lib/supabase/types";

function blankLine(): QuoteLineInput {
  return { serviceId: null, serviceName: "", description: "", qty: 1, unitPrice: 0 };
}

export function QuoteEditor({
  quote,
  items: initialItems,
  clients,
  properties,
  services,
  initialClientId,
  initialRequestId,
  notice,
  gstRegistered = true,
}: {
  quote: Quote | null;
  items: QuoteItem[];
  clients: Client[];
  properties: Property[];
  services: Service[];
  initialClientId?: string;
  initialRequestId?: string;
  notice?: { text: string; tone: "ok" | "error" } | null;
  gstRegistered?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(quote?.client_id ?? initialClientId ?? "");
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", address: "" });
  const [propertyId, setPropertyId] = useState(quote?.property_id ?? "");
  const [quoteDate, setQuoteDate] = useState(quote?.quote_date ?? todayISO());
  const [expiryDate, setExpiryDate] = useState(quote?.expiry_date ?? daysFromToday(30));
  const [mode, setMode] = useState<GstMode>(quote?.mode ?? (gstRegistered ? "exclusive" : "none"));
  const [message, setMessage] = useState(quote?.message ?? "Thanks for the opportunity to quote. Prices are valid for 30 days.");
  const [lines, setLines] = useState<QuoteLineInput[]>(
    initialItems.length
      ? initialItems.map((i) => ({ serviceId: i.service_id, serviceName: i.service_name, description: i.description, qty: i.qty, unitPrice: i.unit_price }))
      : [blankLine()]
  );

  const locked = quote ? !["Draft", "Sent"].includes(quote.status) : false;
  const clientProperties = properties.filter((p) => p.client_id === clientId);
  const totals = calcTotals(lines.map((l) => ({ qty: l.qty, unit_price: l.unitPrice })), mode);

  const input: QuoteInput = { clientId, newClient: isNewClient ? newClient : null, propertyId: propertyId || null, quoteDate, expiryDate, mode, message, requestId: quote?.request_id ?? initialRequestId ?? null, items: lines };

  const commit = (status: "Draft" | "Sent" | "Approved" | "Declined") => {
    setError(null);
    startTransition(async () => {
      if (status === "Sent") {
        const ready = await checkCanSendDocuments();
        if (!ready.ok) {
          setError(ready.error ?? "Can't send yet.");
          return;
        }
      }
      const result = await saveQuote(quote?.id ?? null, input, status);
      if (!result.ok) {
        setError(result.error ?? "Could not save quote.");
        return;
      }
      let query = "";
      if (status === "Sent") {
        const sent = await emailQuote(result.id!);
        const text = sent.ok ? `Quote emailed to ${sent.sentTo}` : `Quote saved as Sent, but the email wasn't sent: ${sent.error}`;
        query = `?notice=${encodeURIComponent(text)}&tone=${sent.ok ? "ok" : "error"}`;
      }
      router.push(`/quotes/${result.id}${query}`);
      router.refresh();
    });
  };

  const resend = () => {
    if (!quote) return;
    setError(null);
    startTransition(async () => {
      const sent = await emailQuote(quote.id);
      if (!sent.ok) {
        setError(sent.error ?? "Could not send email.");
        return;
      }
      router.push(`/quotes/${quote.id}?notice=${encodeURIComponent(`Quote emailed to ${sent.sentTo}`)}&tone=ok`);
    });
  };

  const convert = () => {
    if (!quote) return;
    startTransition(async () => {
      const result = await convertQuoteToJob(quote.id);
      if (!result.ok) {
        setError(result.error ?? "Could not convert to job.");
        return;
      }
      router.push(`/jobs/${result.id}`);
    });
  };

  const cancel = () => {
    if (!quote) return;
    startTransition(async () => {
      const result = await updateQuoteStatus(quote.id, "Cancelled");
      if (!result.ok) {
        setError(result.error ?? "Could not cancel quote.");
        return;
      }
      router.refresh();
    });
  };

  const setLine = (i: number, next: QuoteLineInput) => setLines(lines.map((l, k) => (k === i ? next : l)));

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-5 border-b border-line bg-card-bg">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-primary">{quote ? quote.num : "New quote"}</h1>
            {quote && <StatusBadge status={quote.status.toLowerCase() as "draft" | "sent" | "approved" | "declined" | "expired" | "cancelled"} label={quote.status} showDot />}
          </div>
          <div className="flex gap-2 flex-wrap">
            {quote && (
              <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
                <Button variant="secondary" type="button">
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </a>
            )}
            {quote?.status === "Sent" && (
              <Button variant="secondary" onClick={resend} disabled={pending}>
                <Send className="w-4 h-4" />
                Resend email
              </Button>
            )}
            {!quote && (
              <Button variant="secondary" onClick={() => router.push("/quotes")} disabled={pending}>Cancel</Button>
            )}
            {(!quote || quote.status === "Draft") && (
              <Button variant="secondary" onClick={() => commit("Draft")} disabled={pending}>Save draft</Button>
            )}
            {(!quote || ["Draft", "Sent"].includes(quote.status)) && (
              <Button variant="primary" onClick={() => commit("Sent")} disabled={pending}>Send quote</Button>
            )}
            {quote?.status === "Sent" && (
              <>
                <Button variant="secondary" onClick={() => commit("Declined")} disabled={pending}>Mark declined</Button>
                <Button variant="primary" onClick={() => commit("Approved")} disabled={pending}>Mark approved</Button>
              </>
            )}
            {quote?.status === "Approved" && (
              quote.job_id ? (
                <Button variant="primary" onClick={() => router.push(`/jobs/${quote.job_id}`)}>View job</Button>
              ) : (
                <Button variant="primary" onClick={convert} disabled={pending}>Convert to job</Button>
              )
            )}
            {quote && !quote.job_id && ["Draft", "Sent", "Approved"].includes(quote.status) && (
              <Button variant="secondary" onClick={cancel} disabled={pending}>Cancel quote</Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {notice && (
          <div
            className={`max-w-[1400px] mx-auto mb-5 px-4 py-3 rounded-lg text-sm border ${
              notice.tone === "ok" ? "bg-ok-bg text-ok-fg border-ok-fg/25" : "bg-warn-bg text-warn-fg border-warn-fg/25"
            }`}
          >
            {notice.text}
          </div>
        )}
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-[3] w-full min-w-0 flex flex-col gap-5">
            <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3.5">
              <ClientPicker
                required
                disabled={locked}
                clients={clients}
                value={isNewClient ? NEW_CLIENT : clientId}
                allowNew={!quote || quote.status === "Draft"}
                onChange={(v) => {
                  setIsNewClient(v === NEW_CLIENT);
                  setClientId(v === NEW_CLIENT ? "" : v);
                  setPropertyId("");
                }}
              />
              {isNewClient ? (
                <div className="flex items-end text-xs text-ink-muted pb-2">They&rsquo;ll be added to your Clients list as a Lead when you save.</div>
              ) : (
                <SelectField label="Service address" disabled={locked} value={propertyId} onChange={(e) => setPropertyId(e.target.value)} options={clientProperties.map((p) => ({ value: p.id, label: `${p.street}, ${p.suburb}` }))} placeholder="No property selected" />
              )}
              {isNewClient && (
                <>
                  <TextField label="Client name" required value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                  <TextField label="Email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                  <TextField label="Phone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                  <TextField label="Address" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
                </>
              )}
              <TextField label="Quote date" type="date" disabled={locked} value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
              <TextField label="Expiry date" type="date" disabled={locked} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </Card>

            <Card className="p-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="text-base font-bold text-ink-primary">Line items</h2>
                {gstRegistered && (
                  <div className="flex bg-neutral-bg rounded-lg p-0.5">
                    {(["exclusive", "inclusive"] as GstMode[]).map((m) => (
                      <button key={m} disabled={locked} onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={mode === m ? { background: "#fff" } : {}}>
                        {m === "exclusive" ? "GST exclusive" : "GST inclusive"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-start border-b border-line-soft pb-3">
                    <div className="flex flex-col gap-1.5">
                      <input disabled={locked} value={l.serviceName} onChange={(e) => setLine(i, { ...l, serviceName: e.target.value })} placeholder="Item name" className="w-full h-9 border border-field-border rounded-md px-2.5 text-sm font-semibold" />
                      <input disabled={locked} value={l.description} onChange={(e) => setLine(i, { ...l, description: e.target.value })} placeholder="Description" className="w-full h-8 border border-field-border rounded-md px-2.5 text-xs" />
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
            {error && <p className="text-sm text-danger mt-3">{error}</p>}
          </Card>
            <Card className="p-5">
              <TextAreaField label="Message to client" disabled={locked} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
