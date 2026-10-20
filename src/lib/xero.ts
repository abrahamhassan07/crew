import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { xeroAllowed } from "@/lib/billing";
import { calcTotals } from "@/lib/gst";
import type { GstMode, XeroConnection } from "@/lib/supabase/types";

// Xero accounting integration. Each business connects its own Xero organisation (OAuth 2.0 web app flow);
// sent invoices are then created in that organisation. Everything here runs on the server only.
const IDENTITY = "https://identity.xero.com/connect/token";
const AUTHORIZE = "https://login.xero.com/identity/connect/authorize";
const API = "https://api.xero.com";

// Granular scopes (the broad accounting.transactions scope is being retired). Read-only access to settings is
// only used to list the business's sales and bank accounts; payments is for syncing payments both ways.
export const XERO_SCOPES = ["offline_access", "accounting.invoices", "accounting.contacts", "accounting.settings.read", "accounting.payments"];
const PAYMENT_SCOPE = "accounting.payments";

export const XERO_PLAN_MESSAGE = "Xero is included with the Team plan (2–5 users) and above. See plans to upgrade.";

/** Whether this business's plan includes Xero (see xeroAllowed). */
export async function orgMayUseXero(orgId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("organizations").select("billing_exempt, subscription_status, plan, current_period_end, trial_ends_at, team_size").eq("id", orgId).single();
  return xeroAllowed(data ?? null);
}

export const xeroConfigured = () => !!process.env.XERO_CLIENT_ID && !!process.env.XERO_CLIENT_SECRET;
/** Built from the address the user is actually on (www in production, localhost in development), so it always matches what Xero has registered. */
export const xeroRedirectUri = (origin: string) => `${origin}/api/xero/callback`;

export function xeroAuthorizeUrl(state: string, origin: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: xeroRedirectUri(origin),
    scope: XERO_SCOPES.join(" "),
    state,
  });
  return `${AUTHORIZE}?${params}`;
}

// ---------------------------------------------------------------------------
// Token storage: AES-256-GCM, with the key derived from the Xero client secret (so no extra secret to manage;
// rotating the client secret just means businesses reconnect).
// ---------------------------------------------------------------------------
function tokenKey(): Buffer {
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!secret) throw new Error("Xero isn't configured.");
  return Buffer.from(hkdfSync("sha256", secret, "crew-and-grounds", "xero-token-encryption", 32));
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(IDENTITY, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Xero token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export const exchangeCode = (code: string, origin: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: xeroRedirectUri(origin) });

interface XeroTenant {
  id: string; // the connection id
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

/** The organisations the user just authorised (the access token carries the id of this sign-in), falling back to all of them. */
export async function fetchTenants(accessToken: string): Promise<XeroTenant[]> {
  let authEventId: string | undefined;
  try {
    authEventId = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()).authentication_event_id;
  } catch {
    // fall through to all connections
  }
  const url = `${API}/connections${authEventId ? `?authEventId=${authEventId}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Xero connections request failed (${res.status})`);
  const all = (await res.json()) as XeroTenant[];
  return all.filter((t) => t.tenantType === "ORGANISATION");
}

export async function saveConnection(orgId: string, userId: string, tokens: TokenResponse, tenant: XeroTenant) {
  const admin = createAdminClient();
  const row = {
    org_id: orgId,
    connection_id: tenant.id,
    tenant_id: tenant.tenantId,
    tenant_name: tenant.tenantName,
    access_token: encryptToken(tokens.access_token),
    refresh_token: encryptToken(tokens.refresh_token),
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    connected_by: userId,
    scopes: tokenScopes(tokens.access_token),
  };
  // Reconnecting keeps the chosen sales account and auto-sync setting.
  const { error } = await admin.from("xero_connections").upsert(row, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
}

/** The scopes the business approved, read from the access token (a JWT). */
function tokenScopes(accessToken: string): string[] {
  try {
    const scope = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()).scope;
    return Array.isArray(scope) ? scope : typeof scope === "string" ? scope.split(" ") : [];
  } catch {
    return [];
  }
}

/** Connections made before payments sync existed lack the payments scope and need to reconnect once. */
export const hasPaymentScope = (conn: Pick<XeroConnection, "scopes">) => (conn.scopes ?? []).includes(PAYMENT_SCOPE);

export async function getConnection(orgId: string): Promise<XeroConnection | null> {
  const { data } = await createAdminClient().from("xero_connections").select("*").eq("org_id", orgId).maybeSingle();
  return data ?? null;
}

async function freshAccessToken(conn: XeroConnection): Promise<string> {
  if (new Date(conn.expires_at).getTime() - Date.now() > 60_000) return decryptToken(conn.access_token);
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptToken(conn.refresh_token) });
  await createAdminClient()
    .from("xero_connections")
    .update({
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("org_id", conn.org_id);
  return tokens.access_token;
}

export async function disconnectXero(orgId: string) {
  const conn = await getConnection(orgId);
  if (conn) {
    try {
      const token = await freshAccessToken(conn);
      await fetch(`${API}/connections/${conn.connection_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Revoking on Xero's side is best effort; the local connection is removed regardless.
    }
  }
  const admin = createAdminClient();
  await admin.from("xero_connections").delete().eq("org_id", orgId);
  // The saved links pointed into the Xero organisation that was just disconnected.
  await admin.from("clients").update({ xero_contact_id: null }).eq("org_id", orgId).not("xero_contact_id", "is", null);
  await admin.from("invoices").update({ xero_invoice_id: null, xero_synced_at: null, xero_error: null }).eq("org_id", orgId).not("xero_invoice_id", "is", null);
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
class XeroApiError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

function describeFailure(body: unknown, status: number): string {
  const b = body as { Elements?: { ValidationErrors?: { Message: string }[] }[]; Message?: string; Detail?: string } | null;
  const messages = (b?.Elements ?? []).flatMap((e) => (e.ValidationErrors ?? []).map((v) => v.Message));
  if (messages.length) return messages.join(" ");
  if (status === 401 || status === 403) return "Xero rejected the connection. Reconnect Xero in Settings.";
  if (status === 429) return "Xero is busy right now. Try again in a minute.";
  return b?.Message || b?.Detail || `Xero returned an error (${status}).`;
}

async function xero(conn: XeroConnection, path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const token = await freshAccessToken(conn);
  const res = await fetch(`${API}/api.xro/2.0${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "xero-tenant-id": conn.tenant_id,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new XeroApiError(describeFailure(json, res.status), res.status);
  return json;
}

export interface SalesAccount {
  code: string;
  name: string;
}

/** The business's revenue accounts, for choosing where invoice lines are booked. */
export async function listSalesAccounts(orgId: string): Promise<SalesAccount[]> {
  const conn = await getConnection(orgId);
  if (!conn) return [];
  const data = await xero(conn, `/Accounts?where=${encodeURIComponent('Type=="REVENUE"')}`);
  return ((data?.Accounts ?? []) as { Code?: string; Name: string; Status: string }[])
    .filter((a) => a.Code && a.Status === "ACTIVE")
    .map((a) => ({ code: a.Code!, name: a.Name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

const q = (v: string) => v.replace(/"/g, "");

async function ensureContact(conn: XeroConnection, client: { id: string; name: string; email: string | null; phone: string | null; address: string | null; xero_contact_id: string | null }) {
  // A saved contact only counts if it still exists in the connected Xero (the business may have switched organisations).
  if (client.xero_contact_id) {
    try {
      await xero(conn, `/Contacts/${client.xero_contact_id}`);
      return client.xero_contact_id;
    } catch (e) {
      if (!(e instanceof XeroApiError) || e.status !== 404) throw e;
    }
  }

  let contactId: string | undefined;
  const email = client.email?.trim();
  if (email) {
    const found = await xero(conn, `/Contacts?where=${encodeURIComponent(`EmailAddress=="${q(email)}"`)}`);
    contactId = found?.Contacts?.[0]?.ContactID;
  }
  if (!contactId) {
    const found = await xero(conn, `/Contacts?where=${encodeURIComponent(`Name=="${q(client.name.trim())}"`)}`);
    contactId = found?.Contacts?.[0]?.ContactID;
  }
  if (!contactId) {
    const created = await xero(conn, "/Contacts", {
      method: "POST",
      idempotencyKey: `crew-contact-${client.id}`,
      body: {
        Name: client.name.trim(),
        EmailAddress: email || undefined,
        Phones: client.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: client.phone }] : undefined,
        Addresses: client.address ? [{ AddressType: "STREET", AddressLine1: client.address }] : undefined,
      },
    });
    contactId = created?.Contacts?.[0]?.ContactID;
  }
  if (!contactId) throw new XeroApiError("Xero didn't return a contact for this client.");
  await createAdminClient().from("clients").update({ xero_contact_id: contactId }).eq("id", client.id);
  return contactId;
}

const LINE_AMOUNT_TYPES: Record<GstMode, string> = { exclusive: "Exclusive", inclusive: "Inclusive", none: "NoTax" };

export const xeroInvoiceUrl = (xeroInvoiceId: string) => `https://go.xero.com/app/invoicing/view/${xeroInvoiceId}`;

/**
 * Creates the invoice in Xero (or updates it if it was already copied). Drafts are skipped: an invoice goes to
 * Xero once it's been sent. Voided invoices are voided in Xero too. The outcome is stored on the invoice.
 */
export async function pushInvoice(orgId: string, invoiceId: string): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const admin = createAdminClient();
  const conn = await getConnection(orgId);
  if (!conn) return { ok: false, skipped: true };
  if (!(await orgMayUseXero(orgId))) return { ok: false, error: XERO_PLAN_MESSAGE };

  const fail = async (message: string) => {
    await admin.from("invoices").update({ xero_error: message }).eq("id", invoiceId);
    return { ok: false, error: message };
  };

  try {
    const [{ data: invoice }, { data: items }] = await Promise.all([
      admin.from("invoices").select("*").eq("id", invoiceId).eq("org_id", orgId).single(),
      admin.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
    ]);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status === "Draft") return { ok: true, skipped: true };
    if (invoice.status === "Voided" && !invoice.xero_invoice_id) return { ok: true, skipped: true };

    // Same for the saved invoice link: if that invoice isn't in the connected Xero, start fresh instead of updating a ghost.
    let existingId = invoice.xero_invoice_id;
    let remotePaid = 0;
    if (existingId) {
      try {
        const remote = await xero(conn, `/Invoices/${existingId}`);
        remotePaid = Number(remote?.Invoices?.[0]?.AmountPaid ?? 0);
      } catch (e) {
        if (!(e instanceof XeroApiError) || e.status !== 404) throw e;
        existingId = null;
        await admin.from("invoices").update({ xero_invoice_id: null, xero_synced_at: null }).eq("id", invoiceId);
      }
    }
    if (invoice.status === "Voided" && !existingId) return { ok: true, skipped: true };

    let saved;
    if (existingId && remotePaid > 0 && invoice.status !== "Voided") {
      // Xero won't let an invoice with payments on it be edited, so once it's being paid only payments sync.
      saved = null;
    } else if (invoice.status === "Voided") {
      saved = await xero(conn, `/Invoices/${existingId}`, { method: "POST", body: { InvoiceID: existingId, Status: "VOIDED" } });
    } else {
      const [{ data: client }, { data: job }] = await Promise.all([
        admin.from("clients").select("id, name, email, phone, address, xero_contact_id").eq("id", invoice.client_id).single(),
        invoice.job_id ? admin.from("jobs").select("num").eq("id", invoice.job_id).single() : Promise.resolve({ data: null }),
      ]);
      if (!client) return await fail("The client for this invoice wasn't found.");
      const contactId = await ensureContact(conn, client);
      const taxed = invoice.mode !== "none";
      const body = {
        InvoiceID: existingId ?? undefined,
        Type: "ACCREC",
        Contact: { ContactID: contactId },
        InvoiceNumber: invoice.num,
        Reference: job?.num ? `Job ${job.num}` : undefined,
        Date: invoice.issue_date,
        DueDate: invoice.due_date,
        LineAmountTypes: LINE_AMOUNT_TYPES[invoice.mode],
        Status: "AUTHORISED",
        LineItems: (items ?? []).map((i) => ({
          Description: [i.service_name, i.description].filter(Boolean).join("\n"),
          Quantity: i.qty,
          UnitAmount: i.unit_price,
          AccountCode: conn.sales_account_code,
          TaxType: taxed ? "OUTPUT" : "NONE",
        })),
      };
      saved = await xero(conn, "/Invoices", { method: "POST", body, idempotencyKey: existingId ? undefined : `crew-invoice-${invoice.id}` });
    }
    const xeroId = saved?.Invoices?.[0]?.InvoiceID as string | undefined;
    await admin
      .from("invoices")
      .update({ xero_invoice_id: xeroId ?? existingId, xero_synced_at: new Date().toISOString(), xero_error: null })
      .eq("id", invoiceId);
    if (invoice.status !== "Voided" && (xeroId ?? existingId)) {
      // Bring Xero's payments over first (so a payment entered in both places is matched, not doubled), then send ours.
      await pullPayments(conn, [invoiceId]);
      const pushed = await pushPendingPayments(conn, invoiceId);
      if (pushed.error) return await fail(pushed.error);
    }
    return { ok: true };
  } catch (e) {
    console.error("[xero sync]", e instanceof Error ? e.message : e);
    return await fail(e instanceof XeroApiError ? e.message : "Couldn't reach Xero. Try again in a minute.");
  }
}

/** Fire-and-forget sync after an invoice is sent, edited or voided, when the business has auto-sync on. */
export async function queueXeroSync(orgId: string, invoiceId: string) {
  const conn = await getConnection(orgId);
  if (!conn?.auto_sync || !(await orgMayUseXero(orgId))) return;
  after(() => pushInvoice(orgId, invoiceId));
}

// ---------------------------------------------------------------------------
// Payments: sent to Xero when recorded here, and brought back when recorded in Xero (bank reconciliation etc.)
// ---------------------------------------------------------------------------
export interface BankAccount {
  id: string;
  name: string;
}

/** The business's bank accounts, for choosing where payments recorded here are paid into. */
export async function listBankAccounts(orgId: string): Promise<BankAccount[]> {
  const conn = await getConnection(orgId);
  if (!conn) return [];
  const data = await xero(conn, `/Accounts?where=${encodeURIComponent('Type=="BANK"')}`);
  return ((data?.Accounts ?? []) as { AccountID: string; Name: string; Status: string }[])
    .filter((a) => a.Status === "ACTIVE")
    .map((a) => ({ id: a.AccountID, name: a.Name }));
}

/** Xero's JSON dates look like "/Date(1760918400000+0000)/". */
function xeroDate(v: unknown): string {
  const m = typeof v === "string" ? v.match(/\/Date\((-?\d+)/) : null;
  return (m ? new Date(Number(m[1])) : new Date()).toISOString().slice(0, 10);
}

/** Paid, Partially Paid or back to Sent/Overdue, from the payments recorded against an invoice. */
async function refreshInvoiceStatus(invoiceId: string) {
  const admin = createAdminClient();
  const [{ data: invoice }, { data: items }, { data: payments }] = await Promise.all([
    admin.from("invoices").select("status, mode").eq("id", invoiceId).single(),
    admin.from("invoice_items").select("qty, unit_price").eq("invoice_id", invoiceId),
    admin.from("payments").select("amount").eq("invoice_id", invoiceId),
  ]);
  if (!invoice || invoice.status === "Draft" || invoice.status === "Voided") return;
  const total = calcTotals(items ?? [], invoice.mode).total;
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  // Same rule as recording a payment here; with nothing paid (a Xero payment was deleted) it goes back to Sent.
  const status = paid >= total - 0.01 ? "Paid" : paid > 0 ? "Partially Paid" : invoice.status === "Overdue" ? "Overdue" : "Sent";
  if (status !== invoice.status) await admin.from("invoices").update({ status }).eq("id", invoiceId);
}

interface RemotePayment {
  PaymentID: string;
  Date: string;
  Amount: number;
  Reference?: string;
}

/**
 * Brings payments recorded in Xero into Crew & Grounds for the given invoices (local ids). A payment already
 * recorded here for the same amount within a few days is linked rather than added twice. Payments that came from
 * Xero and have since been deleted there are removed here.
 */
export async function pullPayments(conn: XeroConnection, invoiceIds: string[]): Promise<{ added: number; removed: number }> {
  const admin = createAdminClient();
  const result = { added: 0, removed: 0 };
  const { data: invoices } = await admin.from("invoices").select("id, xero_invoice_id, status").eq("org_id", conn.org_id).in("id", invoiceIds).not("xero_invoice_id", "is", null);
  for (let i = 0; i < (invoices ?? []).length; i += 40) {
    const batch = invoices!.slice(i, i + 40);
    const data = await xero(conn, `/Invoices?IDs=${batch.map((b) => b.xero_invoice_id).join(",")}`);
    for (const remote of (data?.Invoices ?? []) as { InvoiceID: string; Status: string; Payments?: RemotePayment[] }[]) {
      const local = batch.find((b) => b.xero_invoice_id === remote.InvoiceID);
      if (!local || local.status === "Voided" || ["VOIDED", "DELETED"].includes(remote.Status)) continue;
      const remotePayments = remote.Payments ?? [];
      const { data: existing } = await admin.from("payments").select("id, amount, paid_date, xero_payment_id, source").eq("invoice_id", local.id);
      let changed = false;

      for (const rp of remotePayments) {
        if ((existing ?? []).some((p) => p.xero_payment_id === rp.PaymentID)) continue;
        const date = xeroDate(rp.Date);
        const twin = (existing ?? []).find(
          (p) => !p.xero_payment_id && p.source === "app" && Math.abs(Number(p.amount) - rp.Amount) < 0.01 && Math.abs(Date.parse(p.paid_date) - Date.parse(date)) <= 5 * 864e5
        );
        if (twin) {
          await admin.from("payments").update({ xero_payment_id: rp.PaymentID }).eq("id", twin.id);
          twin.xero_payment_id = rp.PaymentID;
          continue;
        }
        const { error } = await admin.from("payments").insert({
          org_id: conn.org_id,
          invoice_id: local.id,
          amount: rp.Amount,
          paid_date: date,
          method: "Recorded in Xero",
          reference: rp.Reference?.trim() || "—",
          xero_payment_id: rp.PaymentID,
          source: "xero",
        });
        if (!error) {
          result.added++;
          changed = true;
        }
      }

      const remoteIds = new Set(remotePayments.map((p) => p.PaymentID));
      const gone = (existing ?? []).filter((p) => p.source === "xero" && p.xero_payment_id && !remoteIds.has(p.xero_payment_id));
      if (gone.length) {
        await admin.from("payments").delete().in("id", gone.map((p) => p.id));
        result.removed += gone.length;
        changed = true;
      }
      if (changed) await refreshInvoiceStatus(local.id);
    }
  }
  return result;
}

/** Sends payments recorded here (and not yet in Xero) for one invoice, when a bank account has been chosen. */
async function pushPendingPayments(conn: XeroConnection, invoiceId: string): Promise<{ sent: number; error?: string }> {
  if (!conn.bank_account_id || !hasPaymentScope(conn)) return { sent: 0 };
  const admin = createAdminClient();
  const [{ data: invoice }, { data: pending }] = await Promise.all([
    admin.from("invoices").select("xero_invoice_id").eq("id", invoiceId).single(),
    admin.from("payments").select("*").eq("invoice_id", invoiceId).eq("source", "app").is("xero_payment_id", null).order("paid_date"),
  ]);
  if (!invoice?.xero_invoice_id || !pending?.length) return { sent: 0 };
  let sent = 0;
  for (const p of pending) {
    try {
      const saved = await xero(conn, "/Payments", {
        method: "PUT",
        idempotencyKey: `crew-payment-${p.id}`,
        body: {
          Invoice: { InvoiceID: invoice.xero_invoice_id },
          Account: { AccountID: conn.bank_account_id },
          Date: p.paid_date,
          Amount: Number(p.amount),
          Reference: [p.method, p.reference !== "—" ? p.reference : ""].filter(Boolean).join(" · ").slice(0, 255) || undefined,
        },
      });
      const id = saved?.Payments?.[0]?.PaymentID as string | undefined;
      if (id) {
        await admin.from("payments").update({ xero_payment_id: id }).eq("id", p.id);
        sent++;
      }
    } catch (e) {
      const why = e instanceof XeroApiError ? e.message : "Couldn't reach Xero.";
      return { sent, error: `A payment couldn't be sent to Xero: ${why}` };
    }
  }
  return { sent };
}

/** Fire-and-forget after a payment is recorded here: make sure the invoice is in Xero, then send the payment. */
export async function queueXeroPayment(orgId: string, invoiceId: string) {
  const conn = await getConnection(orgId);
  if (!conn?.auto_sync || !conn.bank_account_id || !hasPaymentScope(conn) || !(await orgMayUseXero(orgId))) return;
  after(() => pushInvoice(orgId, invoiceId));
}

/** Daily safety net (cron) and webhook catch-up: pull payments for every unpaid invoice that is in Xero. */
export async function syncAllXeroPayments(): Promise<{ orgs: number; added: number; removed: number; errors: number }> {
  const admin = createAdminClient();
  const summary = { orgs: 0, added: 0, removed: 0, errors: 0 };
  const { data: conns } = await admin.from("xero_connections").select("*");
  for (const conn of conns ?? []) {
    if (!(await orgMayUseXero(conn.org_id))) continue;
    const { data: open } = await admin.from("invoices").select("id").eq("org_id", conn.org_id).in("status", ["Sent", "Overdue", "Partially Paid", "Paid"]).not("xero_invoice_id", "is", null).limit(400);
    if (!open?.length) continue;
    summary.orgs++;
    try {
      const r = await pullPayments(conn, open.map((i) => i.id));
      summary.added += r.added;
      summary.removed += r.removed;
    } catch (e) {
      summary.errors++;
      console.error("[xero payments sync]", conn.org_id, e instanceof Error ? e.message : e);
    }
  }
  return summary;
}

/** Xero webhook: an invoice changed in a connected organisation. Pull its payments for every business linked to it. */
export async function handleInvoiceEvents(events: { tenantId: string; resourceId: string; eventCategory: string }[]) {
  const admin = createAdminClient();
  for (const ev of events.filter((e) => e.eventCategory === "INVOICE")) {
    const { data: conns } = await admin.from("xero_connections").select("*").eq("tenant_id", ev.tenantId);
    for (const conn of conns ?? []) {
      if (!(await orgMayUseXero(conn.org_id))) continue;
      const { data: inv } = await admin.from("invoices").select("id").eq("org_id", conn.org_id).eq("xero_invoice_id", ev.resourceId).maybeSingle();
      if (!inv) continue;
      try {
        await pullPayments(conn, [inv.id]);
      } catch (e) {
        console.error("[xero webhook]", e instanceof Error ? e.message : e);
      }
    }
  }
}
