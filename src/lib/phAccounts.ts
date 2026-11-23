import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgMayUseXero } from "@/lib/xero";
import type { PhAccountsConnection } from "@/lib/supabase/types";
import { decryptWith, describePhFailure, encryptWith, phBaseUrl, phRedirectUri } from "@/lib/phAccountsCore";

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
    phApi<{ data: { id: string; code: string; name: string; rate: string }[] }>(conn, "/tax-codes"),
    phApi<{ data: { accountId: string; name: string; bankName: string | null }[] }>(conn, "/bank-accounts"),
  ]);
  return {
    revenue: accounts.data.map((a) => ({ id: a.id, name: `${a.code} · ${a.name}` })),
    // A rate of "0", "0.0000" etc. is not a GST code. Compared as text: no floating-point maths on rates.
    taxCodes: taxCodes.data.filter((t) => !/^0+(\.0+)?$/.test(t.rate)).map((t) => ({ id: t.id, name: `${t.code} · ${t.name}` })),
    banks: banks.data.map((b) => ({ id: b.accountId, name: b.bankName ? `${b.name} (${b.bankName})` : b.name })),
  };
}
