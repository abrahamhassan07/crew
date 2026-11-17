"use client";

import { createClient } from "@/lib/supabase/client";
import { provisionAfterIdTokenSignIn } from "@/app/auth/actions";

/** Development only: report a failure reason to the phone app's log (the web view's console isn't visible there). */
function devLog(text: string) {
  if (process.env.NODE_ENV === "production") return;
  console.warn(text);
  try {
    (window as Window & { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView?.postMessage(JSON.stringify({ type: "debugLog", text }));
  } catch {
    // not inside the app
  }
}

export type IdTokenSignInResult = { ok: true; needsCode: boolean } | { ok: false; error: string };

/**
 * Finishes a Google or Apple sign-in that produced an ID token: swaps the token for a Supabase session in this
 * browser (cookies), finds the person's account or creates the business (signup page only), and reports whether
 * two-factor still needs the code. On any failure the half-made session is cleared.
 */
export async function finishIdTokenSignIn(opts: {
  provider: "google" | "apple";
  token: string;
  rawNonce: string;
  businessName?: string;
  displayName?: string;
}): Promise<IdTokenSignInResult> {
  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithIdToken({ provider: opts.provider, token: opts.token, nonce: opts.rawNonce });
  if (signInError) {
    devLog(`${opts.provider} signInWithIdToken failed: ${signInError.message}`);
    return { ok: false, error: "oauth-failed" };
  }

  const result = await provisionAfterIdTokenSignIn(opts.businessName?.trim(), opts.displayName);
  if (!result.ok) {
    // The account this session points to was just deleted server-side (no matching profile, e.g. an unrecognised
    // email or failed provisioning): clear the orphaned local session. Best-effort; the real reason is what matters.
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore: the session is rejected server-side on the next request anyway
    }
    devLog(`${opts.provider} provisioning failed: ${result.error}`);
    return { ok: false, error: result.error ?? "oauth-failed" };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { ok: true, needsCode: aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" };
}
