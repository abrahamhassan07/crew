import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// Pure helpers for the PH Accounts integration (no Supabase, no Next), so they can be unit tested.
// PH Accounts API docs: https://phaccounts.com/developers

/** What Crew & Grounds asks for: read settings (accounts, tax codes, bank accounts), customers, invoices, payments. */
export const PH_SCOPES = ["settings.read", "contacts", "invoices", "payments"] as const;

export const phBaseUrl = (configured: string | undefined = process.env.PH_ACCOUNTS_BASE_URL) => (configured || "https://phaccounts.com").replace(/\/+$/, "");

/** Built from the address the user is actually on (www in production, localhost in development), like Xero's. */
export const phRedirectUri = (origin: string) => `${origin}/api/phaccounts/callback`;

/** PKCE (RFC 7636, S256): a random verifier kept in a cookie, and its SHA-256 sent to PH Accounts. */
export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}

export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function phAuthorizeUrl(input: { baseUrl: string; clientId: string; origin: string; state: string; challenge: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: phRedirectUri(input.origin),
    scope: PH_SCOPES.join(" "),
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  return `${input.baseUrl}/oauth/authorize?${params}`;
}

// Token storage: AES-256-GCM, key derived from the PH Accounts client secret (same approach as Xero's; rotating
// the client secret means businesses reconnect).
function tokenKey(clientSecret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", clientSecret, "crew-and-grounds", "ph-accounts-token-encryption", 32));
}

export function encryptWith(clientSecret: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(clientSecret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptWith(clientSecret: string, stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(clientSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** A PH Accounts API error body: { error: { code, message, field? } } (OAuth endpoints: { error, error_description }). */
export function describePhFailure(body: unknown, status: number): { code: string; message: string } {
  const b = body as { error?: { code?: string; message?: string } | string; error_description?: string } | null;
  if (b && typeof b.error === "object" && b.error) {
    return { code: b.error.code ?? "request_failed", message: b.error.message ?? `PH Accounts returned an error (${status}).` };
  }
  if (b && typeof b.error === "string") return { code: b.error, message: b.error_description ?? b.error };
  if (status === 429) return { code: "rate_limited", message: "PH Accounts is busy right now. Try again in a minute." };
  return { code: "request_failed", message: `PH Accounts returned an error (${status}).` };
}

/** Errors that mean the business must connect again (the person who connected lost access, or the token was revoked). */
export const needsReconnect = (status: number, code: string) => status === 401 && (code === "reconnect_required" || code === "invalid_token" || code === "invalid_grant");

// ---------------------------------------------------------------------------
// Invoices (step 6b)
// ---------------------------------------------------------------------------

/**
 * A money or quantity value as the decimal string PH Accounts requires ("1000.00", never a JSON number), up to
 * 4 decimal places. Null when it can't be sent (negative, not a number, or too large).
 */
export function toDecimalString(value: number | string): string | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n < 0 || n >= 1e13) return null;
  const fixed = n.toFixed(4).replace(/\.?0+$/, "");
  return /^\d{1,13}(\.\d{1,4})?$/.test(fixed) ? fixed : null;
}

export type CrewGstMode = "exclusive" | "inclusive" | "none";

export interface CrewInvoiceForPh {
  num: string;
  issue_date: string;
  due_date: string;
  mode: CrewGstMode;
  reference: string | null;
  items: { service_name: string; description: string; qty: number; unit_price: number }[];
}

/** A fingerprint of what PH Accounts was sent, so an edit made afterwards can be noticed. */
export function invoiceContentHash(customerId: string, inv: CrewInvoiceForPh): string {
  const content = {
    customerId,
    num: inv.num,
    issue: inv.issue_date,
    due: inv.due_date,
    mode: inv.mode,
    reference: inv.reference ?? "",
    items: inv.items.map((i) => [i.service_name, i.description, toDecimalString(i.qty), toDecimalString(i.unit_price)]),
  };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export type PhInvoiceBody = {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  reference: string;
  notes?: string;
  taxInclusive: boolean;
  status: "DRAFT" | "ISSUED";
  lines: { description: string; quantity: string; unitPrice: string; accountId?: string; taxCodeId?: string }[];
};

/**
 * The POST /v1/invoices body for a Crew invoice. PH Accounts numbers the invoice itself, so Crew's number goes in
 * `reference` (the business can find one from the other); Crew's own reference, if any, goes in the notes.
 * GST lines use the chosen GST tax code; invoices without GST use none.
 */
export function buildPhInvoiceBody(
  inv: CrewInvoiceForPh,
  opts: { customerId: string; revenueAccountId: string | null; gstTaxCodeId: string | null; canIssue: boolean },
): { ok: true; body: PhInvoiceBody } | { ok: false; error: string } {
  const taxed = inv.mode !== "none";
  if (taxed && !opts.gstTaxCodeId) return { ok: false, error: "Choose a GST tax code in Settings › PH Accounts, then send it again." };
  if (inv.items.length === 0) return { ok: false, error: "The invoice has no lines." };
  if (inv.items.length > 200) return { ok: false, error: "PH Accounts takes up to 200 lines per invoice." };
  const lines: PhInvoiceBody["lines"] = [];
  for (const item of inv.items) {
    const quantity = toDecimalString(item.qty);
    const unitPrice = toDecimalString(item.unit_price);
    if (quantity === null || unitPrice === null) {
      return { ok: false, error: `PH Accounts can't take the line "${item.service_name || item.description}": quantities and prices must be zero or more.` };
    }
    lines.push({
      description: ([item.service_name, item.description].filter((s) => s && s.trim()).join("\n") || "Service").slice(0, 1000),
      quantity,
      unitPrice,
      ...(opts.revenueAccountId ? { accountId: opts.revenueAccountId } : {}),
      ...(taxed ? { taxCodeId: opts.gstTaxCodeId! } : {}),
    });
  }
  const notes = inv.reference?.trim();
  return {
    ok: true,
    body: {
      customerId: opts.customerId,
      invoiceDate: inv.issue_date,
      dueDate: inv.due_date,
      reference: inv.num.slice(0, 100),
      ...(notes ? { notes: `Reference: ${notes}`.slice(0, 2000) } : {}),
      taxInclusive: inv.mode === "inclusive",
      status: opts.canIssue ? "ISSUED" : "DRAFT",
      lines,
    },
  };
}

/** The PH Accounts web address of an invoice, for the "In PH Accounts" link. */
export const phInvoiceUrl = (baseUrl: string, phOrgId: string, phInvoiceId: string) => `${baseUrl}/${phOrgId}/sales/invoices/${phInvoiceId}`;

/** A PH Accounts tax rate (a fraction as text, e.g. "0.1" or "0.1000") that is exactly 10%. */
export const isTenPercent = (rate: string) => /^0?\.10*$/.test(rate.trim());

// ---------------------------------------------------------------------------
// Payments and webhooks (step 6c)
// ---------------------------------------------------------------------------

/** A decimal string or number as whole cents, exactly (for comparing money without floating point). */
export function centsOf(value: string | number): bigint {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(text);
  if (!m) return BigInt(0);
  const frac = (m[3] ?? "").padEnd(4, "0");
  const units = BigInt(m[2] + frac); // 4 dp units
  const cents = (units + BigInt(50)) / BigInt(100); // half up
  return m[1] ? -cents : cents;
}

export const centsToString = (cents: bigint) => {
  const negative = cents < BigInt(0);
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
};

/**
 * Checks PH Accounts' webhook signature: header `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, t + "." + raw
 * body)>`, constant-time compare, and no older than 5 minutes (https://phaccounts.com/developers).
 */
export function verifyPhSignature(secret: string, header: string | null, rawBody: string, nowUnixSeconds: number): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2).map((s) => s.trim())));
  const t = Number(parts.t);
  const v1 = String(parts.v1 ?? "");
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(v1) || Math.abs(nowUnixSeconds - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}

export interface PhWebhookEvent {
  id: string;
  type: "invoice.issued" | "invoice.paid" | "invoice.voided" | "payment.created" | "payment.voided";
  occurredAt: string;
  organisationId: string;
  resourceId: string;
}

export function parsePhEvent(rawBody: string): PhWebhookEvent | null {
  try {
    const e = JSON.parse(rawBody) as Partial<PhWebhookEvent>;
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!e.id || !e.type || !e.organisationId || !e.resourceId || !uuid.test(e.organisationId) || !uuid.test(e.resourceId)) return null;
    return e as PhWebhookEvent;
  } catch {
    return null;
  }
}
