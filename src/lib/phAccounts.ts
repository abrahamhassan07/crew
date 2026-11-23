import "server-only";
import { createHash } from "crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgMayUseXero } from "@/lib/xero";
import type { PhAccountsConnection } from "@/lib/supabase/types";
import { buildPhInvoiceBody, isTenPercent, decryptWith, describePhFailure, encryptWith, invoiceContentHash, needsReconnect, phBaseUrl, phRedirectUri, type CrewGstMode } from "@/lib/phAccountsCore";

// "Connect to PH Accounts": each business connects its own PH Accounts business (OAuth 2.0 + PKCE).
// Server only. API docs: https://phaccounts.com/developers

export const phConfigured = () => !!process.env.PH_ACCOUNTS_CLIENT_ID && !!process.env.PH_ACCOUNTS_CLIENT_SECRET;

/** PH Accounts is included on the same plans as Xero (Team plan and above), decided 2026-11-23. */
export const orgMayUsePhAccounts = (orgId: string) => orgMayUseXero(orgId);

export const PH_PLAN_MESSAGE = "PH Accounts is included with the Team plan (2–5 users) and above. See plans to upgrade.";

const secret = () => {
  const s = process.env.PH_ACCOUNTS_CLIENT_SECRET;
  if (!s) throw new Error("PH Accounts isn't configured.");
  return s;
};
const encrypt = (plain: string) => encryptWith(secret(), plain);
const decrypt = (stored: string) => decryptWith(secret(), stored);

export class PhApiError extends Error {
  constructor(message: string, readonly status = 0, readonly code = "request_failed") {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------
export interface PhTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  organisation: { id: string; name: string };
}

async function tokenRequest(path: "token" | "revoke", body: Record<string, string>): Promise<unknown> {
  const basic = Buffer.from(`${process.env.PH_ACCOUNTS_CLIENT_ID}:${secret()}`).toString("base64");
  const res = await fetch(`${phBaseUrl()}/api/oauth/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const f = describePhFailure(json, res.status);
    throw new PhApiError(f.message, res.status, f.code);
  }
  return json;
}

export const exchangeCode = (code: string, origin: string, verifier: string) =>
  tokenRequest("token", { grant_type: "authorization_code", code, redirect_uri: phRedirectUri(origin), code_verifier: verifier }) as Promise<PhTokenResponse>;

/** Saves (or replaces) the business's connection. Reconnecting keeps the chosen accounts and auto-sync setting. */
export async function saveConnection(orgId: string, userId: string, tokens: PhTokenResponse, canIssueInvoices: boolean) {
  const row = {
    org_id: orgId,
    ph_org_id: tokens.organisation.id,
    ph_org_name: tokens.organisation.name,
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token),
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refreshing_until: null,
    scopes: tokens.scope.split(" ").filter(Boolean),
    can_issue_invoices: canIssueInvoices,
    connected_by: userId,
  };
  const admin = createAdminClient();
  const existing = await getConnection(orgId);
  // A different PH Accounts business: the chosen accounts belonged to the old one.
  const reset = existing && existing.ph_org_id !== row.ph_org_id
    ? { revenue_account_id: null, revenue_account_name: null, gst_tax_code_id: null, gst_tax_code_name: null, bank_account_id: null, bank_account_name: null }
    : {};
  const { error } = await admin.from("ph_accounts_connections").upsert({ ...row, ...reset }, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
}

export async function getConnection(orgId: string): Promise<PhAccountsConnection | null> {
  const { data } = await createAdminClient().from("ph_accounts_connections").select("*").eq("org_id", orgId).maybeSingle();
  return data ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A valid access token. PH Accounts refresh tokens rotate on every use and reusing an old one disconnects the
 * app, so two requests must never refresh at once: a request claims the refresh with a conditional update of
 * refreshing_until (only one wins); the others wait for the new token to be saved.
 */
async function freshAccessToken(conn: PhAccountsConnection): Promise<string> {
  const admin = createAdminClient();
  let current = conn;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (new Date(current.expires_at).getTime() - Date.now() > 60_000) return decrypt(current.access_token);
    const now = new Date();
    const { data: claimed } = await admin
      .from("ph_accounts_connections")
      .update({ refreshing_until: new Date(now.getTime() + 20_000).toISOString() })
      .eq("org_id", current.org_id)
      .eq("refresh_token", current.refresh_token)
      // Quoted: the timestamp contains "." and ":", which PostgREST filters otherwise treat as syntax.
      .or(`refreshing_until.is.null,refreshing_until.lt."${now.toISOString()}"`)
      .select("org_id");
    if (claimed?.length) {
      try {
        const tokens = (await tokenRequest("token", { grant_type: "refresh_token", refresh_token: decrypt(current.refresh_token) })) as PhTokenResponse;
        await admin
          .from("ph_accounts_connections")
          .update({
            access_token: encrypt(tokens.access_token),
            refresh_token: encrypt(tokens.refresh_token),
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            refreshing_until: null,
          })
          .eq("org_id", current.org_id);
        return tokens.access_token;
      } catch (e) {
        await admin.from("ph_accounts_connections").update({ refreshing_until: null }).eq("org_id", current.org_id);
        throw e;
      }
    }
    // Someone else is refreshing: wait for their new token.
    await sleep(500);
    const reread = await getConnection(current.org_id);
    if (!reread) throw new PhApiError("PH Accounts isn't connected.", 401, "reconnect_required");
    current = reread;
  }
  throw new PhApiError("Couldn't refresh the PH Accounts connection. Try again in a minute.");
}

export async function disconnectPhAccounts(orgId: string) {
  const conn = await getConnection(orgId);
  if (conn) {
    try {
      // Revoking the refresh token ends the whole connection on PH Accounts' side too.
      await tokenRequest("revoke", { token: decrypt(conn.refresh_token) });
    } catch {
      // Best effort; the local connection is removed regardless.
    }
  }
  await createAdminClient().from("ph_accounts_connections").delete().eq("org_id", orgId);
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
export async function phApi<T = unknown>(conn: PhAccountsConnection, path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const token = await freshAccessToken(conn);
  const res = await fetch(`${phBaseUrl()}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const f = describePhFailure(json, res.status);
    throw new PhApiError(f.message, res.status, f.code);
  }
  return json as T;
}

/** GET /v1/organisation with a just-issued access token (before the connection is saved). */
export async function fetchConnectionInfo(accessToken: string): Promise<{ canIssueInvoices: boolean }> {
  const res = await fetch(`${phBaseUrl()}/api/v1/organisation`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { connection?: { canIssueInvoices?: boolean } } | null;
  if (!res.ok) {
    const f = describePhFailure(json, res.status);
    throw new PhApiError(f.message, res.status, f.code);
  }
  return { canIssueInvoices: json?.connection?.canIssueInvoices === true };
}

export interface PhChoice {
  id: string;
  name: string;
}

/** Revenue accounts, GST tax codes (rate above zero) and bank accounts, for the settings card. */
export async function listPhChoices(conn: PhAccountsConnection): Promise<{ revenue: PhChoice[]; taxCodes: PhChoice[]; banks: PhChoice[] }> {
  const [accounts, taxCodes, banks] = await Promise.all([
    phApi<{ data: { id: string; code: string; name: string }[] }>(conn, "/accounts?type=REVENUE"),
    phApi<{ data: { id: string; code: string; name: string; rate: string; usableForSales?: boolean }[] }>(conn, "/tax-codes"),
    phApi<{ data: { accountId: string; name: string; bankName: string | null }[] }>(conn, "/bank-accounts"),
  ]);
  return {
    revenue: accounts.data.map((a) => ({ id: a.id, name: `${a.code} · ${a.name}` })),
    // Only 10% codes that can go on a sales invoice: Crew & Grounds works GST out at 10% (Australia), so any other
    // rate would make the two apps' totals disagree, and a purchases-only code (e.g. GST_PURCHASES) is refused on
    // invoices. Rates are fractions ("0.1" = 10%), compared as text, never floating-point.
    taxCodes: taxCodes.data.filter((t) => isTenPercent(t.rate) && t.usableForSales !== false).map((t) => ({ id: t.id, name: `${t.code} · ${t.name}` })),
    banks: banks.data.map((b) => ({ id: b.accountId, name: b.bankName ? `${b.name} (${b.bankName})` : b.name })),
  };
}

// ---------------------------------------------------------------------------
// Invoices (step 6b): a sent invoice is created in PH Accounts
// ---------------------------------------------------------------------------
interface PhCustomer {
  id: string;
  displayName: string;
  email: string | null;
  status: string;
}

interface PhInvoice {
  id: string;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  amountPaid: string;
}

const shortHash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);

/** GET that treats 404 as "not there" (the business may have switched to another PH Accounts business). */
async function getOrNull<T>(conn: PhAccountsConnection, path: string): Promise<T | null> {
  try {
    return await phApi<T>(conn, path);
  } catch (e) {
    if (e instanceof PhApiError && e.status === 404) return null;
    throw e;
  }
}

async function ensureCustomer(
  conn: PhAccountsConnection,
  client: { id: string; name: string; email: string | null; phone: string | null; address: string | null; ph_customer_id: string | null },
): Promise<string> {
  // A saved link only counts if that customer is still in the connected business.
  if (client.ph_customer_id && (await getOrNull<PhCustomer>(conn, `/customers/${client.ph_customer_id}`))) return client.ph_customer_id;

  const name = client.name.trim();
  const email = client.email?.trim();
  let found: PhCustomer | undefined;
  if (email) {
    const byEmail = await phApi<{ data: PhCustomer[] }>(conn, `/customers?status=ALL&email=${encodeURIComponent(email)}`);
    found = byEmail.data.find((c) => c.status === "ACTIVE") ?? byEmail.data[0];
  }
  if (!found && name) {
    const byName = await phApi<{ data: PhCustomer[] }>(conn, `/customers?name=${encodeURIComponent(name)}&limit=100`);
    found = byName.data.find((c) => c.displayName.trim().toLowerCase() === name.toLowerCase());
  }
  let customerId = found?.id;
  if (!customerId) {
    const body = {
      displayName: (name || "Customer").slice(0, 200),
      ...(email ? { email } : {}),
      ...(client.phone?.trim() ? { phone: client.phone.trim().slice(0, 50) } : {}),
      ...(client.address?.trim() ? { address: { street: client.address.trim().slice(0, 200) } } : {}),
    };
    const created = await phApi<PhCustomer>(conn, "/customers", {
      method: "POST",
      body,
      // The same client with the same details is only ever added once, even if a request is retried.
      idempotencyKey: `crew-customer-${client.id}-${shortHash(JSON.stringify(body))}`,
    });
    customerId = created.id;
  }
  await createAdminClient().from("clients").update({ ph_customer_id: customerId }).eq("id", client.id);
  return customerId;
}

function friendly(e: unknown): string {
  if (e instanceof PhApiError) {
    if (needsReconnect(e.status, e.code)) return "PH Accounts needs you to connect again. Reconnect it in Settings.";
    if (e.code === "issue_not_allowed") return "This connection can only create drafts in PH Accounts.";
    if (e.code === "insufficient_scope") return "Reconnect PH Accounts in Settings and allow invoices and customers.";
    return e.message;
  }
  return "Couldn't reach PH Accounts. Try again in a minute.";
}

/**
 * Creates the invoice in PH Accounts (finished, or a draft when the connection is drafts-only). Drafts here are
 * skipped: an invoice goes over once it's been sent. Voiding here voids it there. PH Accounts' API can't edit an
 * issued invoice, so if a sent invoice is changed here while its PH Accounts copy is still unpaid, that copy is
 * voided (reversed, kept in history) and a corrected one is created. The outcome is stored on the invoice.
 */
export async function pushInvoiceToPh(orgId: string, invoiceId: string): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const admin = createAdminClient();
  const conn = await getConnection(orgId);
  if (!conn) return { ok: false, skipped: true };
  if (!(await orgMayUsePhAccounts(orgId))) return { ok: false, error: PH_PLAN_MESSAGE };

  const fail = async (message: string) => {
    await admin.from("invoices").update({ ph_error: message }).eq("id", invoiceId);
    return { ok: false, error: message };
  };

  try {
    const [{ data: invoice }, { data: items }] = await Promise.all([
      admin.from("invoices").select("*").eq("id", invoiceId).eq("org_id", orgId).single(),
      admin.from("invoice_items").select("service_name, description, qty, unit_price").eq("invoice_id", invoiceId).order("sort_order"),
    ]);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status === "Draft") return { ok: true, skipped: true };

    let remote = invoice.ph_invoice_id ? await getOrNull<PhInvoice>(conn, `/invoices/${invoice.ph_invoice_id}`) : null;
    if (invoice.ph_invoice_id && !remote) {
      await admin.from("invoices").update({ ph_invoice_id: null, ph_synced_at: null, ph_sync_hash: null }).eq("id", invoiceId);
    }

    const voidRemote = async (target: PhInvoice, why: string) => {
      if (target.status === "VOID") return null;
      if (target.status === "DRAFT") return `It's a draft in PH Accounts, so ${why} there yourself.`;
      if (!conn.can_issue_invoices) return `This connection can only create drafts, so ${why} in PH Accounts yourself.`;
      if (target.amountPaid !== "0.00") return `It has payments in PH Accounts, so ${why} there yourself (void its payments first).`;
      await phApi(conn, `/invoices/${target.id}/void`, {
        method: "POST",
        body: { reason: `Voided in Crew & Grounds (${invoice.num})` },
        idempotencyKey: `crew-void-${target.id}`,
      });
      return null;
    };

    if (invoice.status === "Voided") {
      if (!remote) return { ok: true, skipped: true };
      const problem = await voidRemote(remote, "void it");
      if (problem) return await fail(problem);
      await admin.from("invoices").update({ ph_synced_at: new Date().toISOString(), ph_error: null }).eq("id", invoiceId);
      return { ok: true };
    }

    const { data: client } = await admin.from("clients").select("id, name, email, phone, address, ph_customer_id").eq("id", invoice.client_id).single();
    if (!client) return await fail("The client for this invoice wasn't found.");
    const customerId = await ensureCustomer(conn, client);
    const crewInvoice = { num: invoice.num, issue_date: invoice.issue_date, due_date: invoice.due_date, mode: invoice.mode as CrewGstMode, reference: invoice.reference, items: items ?? [] };
    const hash = invoiceContentHash(customerId, crewInvoice);

    if (remote && invoice.ph_sync_hash === hash) {
      await admin.from("invoices").update({ ph_error: null }).eq("id", invoiceId);
      return { ok: true };
    }
    if (remote) {
      // Changed here after it reached PH Accounts: replace the unpaid copy.
      const problem = await voidRemote(remote, "update it");
      if (problem) return await fail(`This invoice changed after it was sent to PH Accounts. ${problem}`);
      remote = null;
    }

    const built = buildPhInvoiceBody(crewInvoice, {
      customerId,
      revenueAccountId: conn.revenue_account_id,
      gstTaxCodeId: conn.gst_tax_code_id,
      canIssue: conn.can_issue_invoices,
    });
    if (!built.ok) return await fail(built.error);
    const created = await phApi<PhInvoice>(conn, "/invoices", {
      method: "POST",
      body: built.body,
      // Retrying the same version of this invoice never creates a second copy.
      idempotencyKey: `crew-invoice-${invoice.id}-${hash.slice(0, 16)}`,
    });
    await admin
      .from("invoices")
      .update({ ph_invoice_id: created.id, ph_sync_hash: hash, ph_synced_at: new Date().toISOString(), ph_error: null })
      .eq("id", invoiceId);
    return { ok: true };
  } catch (e) {
    console.error("[phaccounts sync]", e instanceof Error ? e.message : e);
    return await fail(friendly(e));
  }
}

/** Fire-and-forget sync after an invoice is sent, edited or voided, when the business has auto-sync on. */
export async function queuePhSync(orgId: string, invoiceId: string) {
  const conn = await getConnection(orgId);
  if (!conn?.auto_sync || !(await orgMayUsePhAccounts(orgId))) return;
  after(() => pushInvoiceToPh(orgId, invoiceId));
}
