"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/errors";
import { assignedClientIds, staffDraftContext } from "@/lib/staffDrafts";
import { isIsoDate } from "@/lib/audit/engine";
import { nextInvoiceNumber, numberPart, type NumberingSettings } from "@/lib/invoiceNumbers";
import type { GstMode } from "@/lib/supabase/types";
import type { CreateResult, InvoiceInput, QuoteInput } from "./actions";

// Staff drafts. A staff member can create and edit their OWN DRAFT quotes and invoices for clients on jobs assigned to
// them. They are saved as "pending approval": nothing can be sent until an owner or admin approves it. Staff cannot
// send, approve, void, record payments, add clients or see anyone else's documents.

const MODES: GstMode[] = ["inclusive", "exclusive", "none"];
const MAX_LINES = 40;

type Lines = QuoteInput["items"];

async function checkLines(orgId: string, items: Lines): Promise<string | null> {
  if (!items.length) return "Add at least one line item.";
  if (items.length > MAX_LINES) return `Keep it to ${MAX_LINES} line items or fewer.`;
  for (const i of items) {
    if (!i.serviceName.trim() || i.serviceName.length > 200) return "Every line item needs a name (up to 200 characters).";
    if (i.description.length > 1000) return "A line description is too long.";
    if (!Number.isFinite(i.qty) || i.qty <= 0 || i.qty > 1000) return "Quantities must be between 0 and 1000.";
    if (!Number.isFinite(i.unitPrice) || i.unitPrice < 0 || i.unitPrice > 100000) return "Prices must be between $0 and $100,000.";
  }
  const ids = [...new Set(items.map((i) => i.serviceId).filter((x): x is string => !!x))];
  if (ids.length) {
    const { data } = await createAdminClient().from("services").select("id").eq("org_id", orgId).in("id", ids);
    if ((data ?? []).length !== ids.length) return "One of the services isn't in your price list.";
  }
  return null;
}

async function checkClientAndProperty(orgId: string, staffId: string, clientId: string, propertyId: string | null): Promise<string | null> {
  if (!clientId) return "Choose a client.";
  const allowed = await assignedClientIds(orgId, staffId);
  if (!allowed.includes(clientId)) return "You can only prepare drafts for clients on jobs assigned to you.";
  if (propertyId) {
    const { data } = await createAdminClient().from("properties").select("id").eq("id", propertyId).eq("client_id", clientId).eq("org_id", orgId).maybeSingle();
    if (!data) return "That address doesn't belong to this client.";
  }
  return null;
}

export async function saveStaffQuote(id: string | null, input: QuoteInput): Promise<CreateResult> {
  const ctx = await staffDraftContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { viewer, staffId } = ctx;
  if (!MODES.includes(input.mode)) return { ok: false, error: "Choose how GST applies." };
  if (!isIsoDate(input.quoteDate) || !isIsoDate(input.expiryDate)) return { ok: false, error: "Enter valid dates." };
  const bad = (await checkClientAndProperty(viewer.orgId, staffId, input.clientId, input.propertyId)) ?? (await checkLines(viewer.orgId, input.items));
  if (bad) return { ok: false, error: bad };

  const admin = createAdminClient();
  const fields = {
    client_id: input.clientId,
    property_id: input.propertyId,
    quote_date: input.quoteDate,
    expiry_date: input.expiryDate,
    mode: input.mode,
    message: (input.message ?? "").trim().slice(0, 2000),
    service_notes: (input.serviceNotes ?? "").trim().slice(0, 2000),
    // Any edit by staff sends it back for review.
    approval_status: "pending" as const,
    approved_by: null,
    approved_at: null,
  };
  let quoteId = id;
  if (quoteId) {
    const { data: own } = await admin.from("quotes").select("id").eq("id", quoteId).eq("org_id", viewer.orgId).eq("created_by", viewer.userId).eq("status", "Draft").maybeSingle();
    if (!own) return { ok: false, error: "You can only change your own drafts." };
    const { error } = await admin.from("quotes").update(fields).eq("id", quoteId);
    if (error) return { ok: false, error: dbError(error) };
    await admin.from("quote_items").delete().eq("quote_id", quoteId);
  } else {
    const { data: existing } = await admin.from("quotes").select("num").eq("org_id", viewer.orgId);
    const max = (existing ?? []).reduce((m, r) => Math.max(m, parseInt(r.num.replace(/\D/g, ""), 10) || 0), 1000);
    const { data, error } = await admin
      .from("quotes")
      .insert({ ...fields, num: `Q-${max + 1}`, status: "Draft", org_id: viewer.orgId, created_by: viewer.userId, ai_generated: input.aiGenerated === true })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error ? dbError(error) : "Could not create the quote." };
    quoteId = data.id;
  }
  const { error: itemsError } = await admin.from("quote_items").insert(
    input.items.map((i, k) => ({ quote_id: quoteId!, service_id: i.serviceId, service_name: i.serviceName.trim(), description: i.description.trim(), qty: i.qty, unit_price: i.unitPrice, sort_order: k, org_id: viewer.orgId }))
  );
  if (itemsError) return { ok: false, error: dbError(itemsError) };
  revalidatePath("/", "layout");
  return { ok: true, id: quoteId! };
}

export async function saveStaffInvoice(id: string | null, input: InvoiceInput): Promise<CreateResult> {
  const ctx = await staffDraftContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { viewer, staffId, org } = ctx;
  if (!MODES.includes(input.mode)) return { ok: false, error: "Choose how GST applies." };
  if (!isIsoDate(input.issueDate) || !isIsoDate(input.dueDate)) return { ok: false, error: "Enter valid dates." };
  const bad = (await checkClientAndProperty(viewer.orgId, staffId, input.clientId, input.propertyId)) ?? (await checkLines(viewer.orgId, input.items));
  if (bad) return { ok: false, error: bad };

  const admin = createAdminClient();
  if (input.jobId) {
    const { data: job } = await admin.from("jobs").select("id").eq("id", input.jobId).eq("org_id", viewer.orgId).eq("assigned_staff_id", staffId).eq("client_id", input.clientId).maybeSingle();
    if (!job) return { ok: false, error: "That job isn't assigned to you for this client." };
  }
  const fields = {
    client_id: input.clientId,
    property_id: input.propertyId,
    job_id: input.jobId,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    mode: input.mode,
    notes: (input.notes ?? "").trim().slice(0, 2000),
    service_notes: (input.serviceNotes ?? "").trim().slice(0, 2000),
    reference: (input.reference ?? "").trim().slice(0, 255),
    approval_status: "pending" as const,
    approved_by: null,
    approved_at: null,
  };
  let invoiceId = id;
  if (invoiceId) {
    const { data: own } = await admin.from("invoices").select("id").eq("id", invoiceId).eq("org_id", viewer.orgId).eq("created_by", viewer.userId).eq("status", "Draft").maybeSingle();
    if (!own) return { ok: false, error: "You can only change your own drafts." };
    const { error } = await admin.from("invoices").update(fields).eq("id", invoiceId);
    if (error) return { ok: false, error: dbError(error) };
    await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
  } else {
    const settings: NumberingSettings = { prefix: org.invoice_prefix ?? "INV-", next: org.invoice_next_number ?? null, digits: org.invoice_number_digits ?? 1 };
    const { data: rows } = await admin.from("invoices").select("num").eq("org_id", viewer.orgId);
    const auto = nextInvoiceNumber(settings, (rows ?? []).map((r) => r.num));
    const { data, error } = await admin
      .from("invoices")
      .insert({ ...fields, num: auto.num, status: "Draft", org_id: viewer.orgId, created_by: viewer.userId, ai_generated: input.aiGenerated === true })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.code === "23505" ? "Another invoice was just created. Please save again." : error ? dbError(error) : "Could not create the invoice." };
    invoiceId = data.id;
    if (settings.next != null && (numberPart(settings.prefix, auto.num) ?? 0) >= settings.next) await admin.from("organizations").update({ invoice_next_number: auto.n + 1 }).eq("id", viewer.orgId);
  }
  const { error: itemsError } = await admin.from("invoice_items").insert(
    input.items.map((i, k) => ({ invoice_id: invoiceId!, service_id: i.serviceId, service_name: i.serviceName.trim(), description: i.description.trim(), qty: i.qty, unit_price: i.unitPrice, sort_order: k, org_id: viewer.orgId }))
  );
  if (itemsError) return { ok: false, error: dbError(itemsError) };
  revalidatePath("/", "layout");
  return { ok: true, id: invoiceId! };
}

/** A staff member deletes one of their own drafts (never one that has gone out). */
export async function deleteStaffDraft(kind: "quote" | "invoice", id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await staffDraftContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const admin = createAdminClient();
  const table = kind === "quote" ? "quotes" : "invoices";
  const { data, error } = await admin.from(table).delete().eq("id", id).eq("org_id", ctx.viewer.orgId).eq("created_by", ctx.viewer.userId).eq("status", "Draft").select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "That draft couldn't be found." };
  revalidatePath("/", "layout");
  return { ok: true };
}
