import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

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
