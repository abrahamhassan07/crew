import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildPhInvoiceBody,
  decryptWith,
  describePhFailure,
  encryptWith,
  invoiceContentHash,
  isTenPercent,
  needsReconnect,
  newPkce,
  phAuthorizeUrl,
  phBaseUrl,
  phInvoiceUrl,
  phRedirectUri,
  pkceChallenge,
  toDecimalString,
} from "../src/lib/phAccountsCore.ts";

test("PKCE: the challenge is the base64url SHA-256 of a fresh random verifier", () => {
  const a = newPkce();
  const b = newPkce();
  assert.notEqual(a.verifier, b.verifier);
  assert.match(a.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.challenge, createHash("sha256").update(a.verifier).digest("base64url"));
  assert.equal(pkceChallenge(a.verifier), a.challenge);
});

test("the consent URL asks for exactly what Crew needs, with PKCE S256", () => {
  const url = new URL(phAuthorizeUrl({ baseUrl: "https://phaccounts.com", clientId: "abc", origin: "https://www.crewandgrounds.com", state: "s1", challenge: "c1" }));
  assert.equal(url.origin + url.pathname, "https://phaccounts.com/oauth/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "abc");
  assert.equal(url.searchParams.get("redirect_uri"), "https://www.crewandgrounds.com/api/phaccounts/callback");
  assert.equal(url.searchParams.get("scope"), "settings.read contacts invoices payments");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("code_challenge"), "c1");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(phRedirectUri("http://localhost:5200"), "http://localhost:5200/api/phaccounts/callback");
});

test("base URL defaults to phaccounts.com and drops a trailing slash", () => {
  assert.equal(phBaseUrl(undefined), "https://phaccounts.com");
  assert.equal(phBaseUrl(""), "https://phaccounts.com");
  assert.equal(phBaseUrl("http://localhost:3000/"), "http://localhost:3000");
});

test("tokens are encrypted at rest and only the same client secret can read them", () => {
  const stored = encryptWith("secret-1", "phat_abc");
  assert.notEqual(stored, "phat_abc");
  assert.ok(!stored.includes("phat_"));
  assert.notEqual(encryptWith("secret-1", "phat_abc"), stored); // random IV
  assert.equal(decryptWith("secret-1", stored), "phat_abc");
  assert.throws(() => decryptWith("secret-2", stored));
});

test("reads both PH Accounts error shapes", () => {
  assert.deepEqual(describePhFailure({ error: { code: "issue_not_allowed", message: "Drafts only." } }, 403), { code: "issue_not_allowed", message: "Drafts only." });
  assert.deepEqual(describePhFailure({ error: "invalid_grant", error_description: "Expired." }, 400), { code: "invalid_grant", message: "Expired." });
  assert.equal(describePhFailure(null, 429).code, "rate_limited");
  assert.equal(describePhFailure(null, 502).code, "request_failed");
});

test("only lost-access errors ask the business to reconnect", () => {
  assert.equal(needsReconnect(401, "reconnect_required"), true);
  assert.equal(needsReconnect(401, "invalid_token"), true);
  assert.equal(needsReconnect(403, "insufficient_scope"), false);
  assert.equal(needsReconnect(429, "rate_limited"), false);
});

// --- Invoices (6b) ---

test("money and quantities become decimal strings, never numbers", () => {
  assert.equal(toDecimalString(1000), "1000");
  assert.equal(toDecimalString(85.5), "85.5");
  assert.equal(toDecimalString(0.1 + 0.2), "0.3");
  assert.equal(toDecimalString(1.23456), "1.2346");
  assert.equal(toDecimalString(0), "0");
  assert.equal(toDecimalString("12.50"), "12.5");
  assert.equal(toDecimalString(-5), null);
  assert.equal(toDecimalString(Number.NaN), null);
  assert.equal(toDecimalString(1e13), null);
});

const inv = {
  num: "INV-1042",
  issue_date: "2026-11-20",
  due_date: "2026-12-04",
  mode: "exclusive" as const,
  reference: "Job J-77",
  items: [
    { service_name: "Lawn mowing", description: "8 Tuft St", qty: 1, unit_price: 85 },
    { service_name: "Hedge trim", description: "", qty: 1.5, unit_price: 60 },
  ],
};

test("an invoice becomes a PH Accounts body: Crew's number as the reference, GST code on taxed lines", () => {
  const built = buildPhInvoiceBody(inv, { customerId: "c1", revenueAccountId: "r1", gstTaxCodeId: "g1", canIssue: true });
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.equal(built.body.reference, "INV-1042");
  assert.equal(built.body.notes, "Reference: Job J-77");
  assert.equal(built.body.status, "ISSUED");
  assert.equal(built.body.taxInclusive, false);
  assert.deepEqual(built.body.lines[0], { description: "Lawn mowing\n8 Tuft St", quantity: "1", unitPrice: "85", accountId: "r1", taxCodeId: "g1" });
  assert.deepEqual(built.body.lines[1], { description: "Hedge trim", quantity: "1.5", unitPrice: "60", accountId: "r1", taxCodeId: "g1" });
});

test("drafts-only connections send drafts; GST-inclusive and no-GST invoices map correctly", () => {
  const draft = buildPhInvoiceBody(inv, { customerId: "c1", revenueAccountId: null, gstTaxCodeId: "g1", canIssue: false });
  assert.ok(draft.ok && draft.body.status === "DRAFT" && !("accountId" in draft.body.lines[0]));
  const incl = buildPhInvoiceBody({ ...inv, mode: "inclusive" }, { customerId: "c1", revenueAccountId: null, gstTaxCodeId: "g1", canIssue: true });
  assert.ok(incl.ok && incl.body.taxInclusive === true);
  const none = buildPhInvoiceBody({ ...inv, mode: "none" }, { customerId: "c1", revenueAccountId: null, gstTaxCodeId: null, canIssue: true });
  assert.ok(none.ok && none.body.lines.every((l) => !("taxCodeId" in l)));
});

test("refuses what PH Accounts would reject, with a message the business can act on", () => {
  const noCode = buildPhInvoiceBody(inv, { customerId: "c1", revenueAccountId: null, gstTaxCodeId: null, canIssue: true });
  assert.ok(!noCode.ok && /GST tax code/.test(noCode.error));
  const negative = buildPhInvoiceBody({ ...inv, items: [{ service_name: "Discount", description: "", qty: 1, unit_price: -10 }] }, { customerId: "c1", revenueAccountId: null, gstTaxCodeId: "g1", canIssue: true });
  assert.ok(!negative.ok && /Discount/.test(negative.error));
  const empty = buildPhInvoiceBody({ ...inv, items: [] }, { customerId: "c1", revenueAccountId: null, gstTaxCodeId: "g1", canIssue: true });
  assert.ok(!empty.ok);
});

test("the content fingerprint changes when the invoice does, and only then", () => {
  const h = invoiceContentHash("c1", inv);
  assert.equal(invoiceContentHash("c1", { ...inv, items: inv.items.map((i) => ({ ...i })) }), h);
  assert.notEqual(invoiceContentHash("c1", { ...inv, due_date: "2026-12-05" }), h);
  assert.notEqual(invoiceContentHash("c1", { ...inv, items: [{ ...inv.items[0], unit_price: 90 }, inv.items[1]] }), h);
  assert.notEqual(invoiceContentHash("c2", inv), h);
});

test("links to the invoice inside the right PH Accounts business", () => {
  assert.equal(phInvoiceUrl("https://phaccounts.com", "org1", "inv1"), "https://phaccounts.com/org1/sales/invoices/inv1");
});

test("only exactly-10% tax codes count as GST", () => {
  for (const r of ["0.1", "0.10", "0.1000", ".1"]) assert.equal(isTenPercent(r), true, r);
  for (const r of ["0", "0.12", "0.01", "1", "0.15", "10"]) assert.equal(isTenPercent(r), false, r);
});
