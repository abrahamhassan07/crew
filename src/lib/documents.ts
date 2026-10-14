import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { calcTotals } from "@/lib/gst";
import { formatPropertyAddress } from "@/lib/design";
import type { DocData } from "@/lib/pdf";

function fmtDocDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

async function loadOrg(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  return data ?? null;
}

async function loadParties(clientId: string, propertyId: string | null) {
  const supabase = await createClient();
  const [{ data: client }, { data: property }] = await Promise.all([
    supabase.from("clients").select("name, address, email").eq("id", clientId).single(),
    propertyId ? supabase.from("properties").select("*").eq("id", propertyId).single() : Promise.resolve({ data: null }),
  ]);
  return { client: client ?? null, serviceAddress: property ? formatPropertyAddress(property) : "" };
}

export interface LoadedDoc {
  doc: DocData;
  total: number;
  filename: string;
}

export async function loadQuoteDoc(id: string): Promise<LoadedDoc | null> {
  const viewer = await getViewer();
  const supabase = await createClient();
  const [{ data: quote }, { data: items }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order"),
  ]);
  if (!quote) return null;
  const [org, parties] = await Promise.all([loadOrg(viewer.orgId), loadParties(quote.client_id, quote.property_id)]);
  const lines = (items ?? []).map((i) => ({ name: i.service_name, description: i.description, qty: i.qty, unitPrice: i.unit_price }));
  return {
    doc: {
      kind: "Quote",
      num: quote.num,
      org,
      ...parties,
      dates: [
        { label: "Quote date", value: fmtDocDate(quote.quote_date) },
        { label: "Valid until", value: fmtDocDate(quote.expiry_date) },
      ],
      mode: quote.mode,
      lines,
      note: quote.message,
    },
    total: calcTotals(lines.map((l) => ({ qty: l.qty, unit_price: l.unitPrice })), quote.mode).total,
    filename: `${quote.num}.pdf`,
  };
}

export async function loadInvoiceDoc(id: string): Promise<LoadedDoc | null> {
  const viewer = await getViewer();
  const supabase = await createClient();
  const [{ data: invoice }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("payments").select("amount").eq("invoice_id", id),
  ]);
  if (!invoice) return null;
  const [org, parties, job] = await Promise.all([
    loadOrg(viewer.orgId),
    loadParties(invoice.client_id, invoice.property_id),
    invoice.job_id ? supabase.from("jobs").select("num").eq("id", invoice.job_id).single() : Promise.resolve({ data: null }),
  ]);
  const lines = (items ?? []).map((i) => ({ name: i.service_name, description: i.description, qty: i.qty, unitPrice: i.unit_price }));
  const paid = (payments ?? []).reduce((s, p) => s + p.amount, 0);
  return {
    doc: {
      kind: "Tax Invoice",
      num: invoice.num,
      org,
      ...parties,
      dates: [
        { label: "Issued", value: fmtDocDate(invoice.issue_date) },
        { label: "Due", value: fmtDocDate(invoice.due_date) },
      ],
      mode: invoice.mode,
      lines,
      note: invoice.notes,
      paid,
      jobNum: job.data?.num ?? null,
    },
    total: calcTotals(lines.map((l) => ({ qty: l.qty, unit_price: l.unitPrice })), invoice.mode).total,
    filename: `${invoice.num}.pdf`,
  };
}
