import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decryptWith, describePhFailure, encryptWith, needsReconnect, newPkce, phAuthorizeUrl, phBaseUrl, phRedirectUri, pkceChallenge } from "../src/lib/phAccountsCore.ts";

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
