"use client";

import { useActionState, useState } from "react";
import { signIn } from "./actions";
import { createClient } from "@/lib/supabase/client";

const OAUTH_ERRORS: Record<string, string> = {
  "oauth-failed": "Google sign-in failed. Please try again.",
  "no-account": "No account found for that Google email. Ask your admin to invite you, or create a new business.",
};

export function LoginForm({ next, oauthError }: { next: string; oauthError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  const [googlePending, setGooglePending] = useState(false);

  async function signInWithGoogle() {
    setGooglePending(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googlePending}
        className="px-4 py-2.5 rounded-lg border border-field-border text-sm font-semibold text-ink-primary flex items-center justify-center gap-2 hover:bg-page-bg transition-colors disabled:opacity-60"
      >
        <GoogleIcon />
        {googlePending ? "Redirecting…" : "Continue with Google"}
      </button>

      {oauthError && <p className="text-sm text-danger-red">{OAUTH_ERRORS[oauthError] ?? "Something went wrong. Please try again."}</p>}

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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.4 35.2 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5c3.6 6.7 10.1 10.9 17.8 10.9z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
