"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadGoogleIdentity, sha256Hex } from "@/lib/googleIdentity";
import { provisionAfterGoogleSignIn } from "@/app/auth/actions";

/**
 * Renders Google's own "Sign In With Google" button via Google Identity
 * Services and exchanges the resulting ID token for a Supabase session
 * client-side (supabase.auth.signInWithIdToken) — no redirect through
 * Supabase's own domain, so the Google consent screen shows this site's
 * own domain instead of the Supabase project's.
 *
 * businessName is only passed on the signup page: while it's empty, the
 * real Google button is withheld (Google's popup can't be pre-validated
 * before it opens) in favor of a disabled placeholder.
 */
export function GoogleSignInButton({
  next,
  businessName,
  onError,
}: {
  next: string;
  businessName?: string;
  onError: (code: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const businessNameRef = useRef(businessName);
  businessNameRef.current = businessName;

  const [pending, setPending] = useState(false);
  const isSignup = businessName !== undefined;
  const gated = isSignup && !businessName.trim();

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !containerRef.current || gated) return;

    let cancelled = false;
    (async () => {
      await loadGoogleIdentity();
      if (cancelled || !containerRef.current) return;

      const rawNonce = crypto.randomUUID();
      const hashedNonce = await sha256Hex(rawNonce);

      google.accounts.id.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        callback: async (response) => {
          setPending(true);
          try {
            const supabase = createClient();
            const { error: signInError } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: rawNonce,
            });
            if (signInError) {
              setPending(false);
              onError("oauth-failed");
              return;
            }

            const result = await provisionAfterGoogleSignIn(businessNameRef.current?.trim());
            if (!result.ok) {
              // The account this session points to was just deleted server-side
              // (no matching profile, e.g. unrecognized email or failed
              // provisioning) — clear the now-orphaned local session so the
              // browser doesn't keep presenting a stale cookie for a user that
              // no longer exists. Best-effort: a failure here must never mask
              // the actual reason, which is what the user needs to see.
              try {
                await supabase.auth.signOut();
              } catch {
                // ignore — session will still get rejected server-side next request
              }
              setPending(false);
              onError(result.error ?? "oauth-failed");
              return;
            }
            window.location.assign(next);
          } catch {
            setPending(false);
            onError("oauth-failed");
          }
        },
      });

      const width = Math.min(containerRef.current.offsetWidth || 320, 400);
      google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: isSignup ? "signup_with" : "continue_with",
        width,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [next, gated, onError, isSignup]);

  if (gated) {
    return (
      <div className="px-4 py-2.5 rounded-lg border border-field-border text-sm font-semibold text-ink-muted flex items-center justify-center gap-2 bg-page-bg">
        Enter your business name to continue with Google
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full flex justify-center" />
      {pending && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-ink-muted">Signing in…</div>}
    </div>
  );
}
