"use client";

import { useActionState, useState } from "react";
import { signIn } from "./actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const OAUTH_ERRORS: Record<string, string> = {
  "oauth-failed": "Google sign-in failed. Please try again.",
  "no-account": "No account found for that Google email. Ask your admin to invite you, or create a new business.",
};

export function LoginForm({ next, oauthError }: { next: string; oauthError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  const [googleError, setGoogleError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton next={next} onError={setGoogleError} />

      {(googleError || oauthError) && (
        <p className="text-sm text-danger-red">{OAUTH_ERRORS[googleError ?? oauthError ?? ""] ?? "Something went wrong. Please try again."}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <div className="flex-1 h-px bg-line" />
        or
        <div className="flex-1 h-px bg-line" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="block text-sm font-semibold text-ink-primary mb-1.5" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-ink-primary" htmlFor="password">
              Password
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
          />
        </div>
        {state?.error && <p className="text-sm text-danger-red">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
