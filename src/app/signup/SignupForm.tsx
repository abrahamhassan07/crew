"use client";

import { useActionState, useState } from "react";
import { signUp } from "./actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const OAUTH_ERRORS: Record<string, string> = {
  "oauth-failed": "Google sign-in failed. Please try again.",
  "could-not-create-business": "Could not create your business. Please try again.",
};

export function SignupForm({ oauthError }: { oauthError?: string }) {
  const [state, formAction, pending] = useActionState(signUp, undefined);
  const [businessName, setBusinessName] = useState("");
  const [googleError, setGoogleError] = useState<string | null>(null);

  if (state?.done) {
    return (
      <p className="text-sm text-ink-primary text-center">
        Check your email to confirm your account, then{" "}
        <a href="/login" className="text-brand font-semibold">
          sign in
        </a>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-semibold text-ink-primary mb-1.5" htmlFor="businessName">
          Business name
        </label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          required
          autoComplete="organization"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
        />
      </div>

      <GoogleSignInButton next="/dashboard" businessName={businessName} onError={setGoogleError} />

      {(googleError || oauthError) && (
        <p className="text-sm text-danger-red">{OAUTH_ERRORS[googleError ?? oauthError ?? ""] ?? "Something went wrong. Please try again."}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <div className="flex-1 h-px bg-line" />
        or
        <div className="flex-1 h-px bg-line" />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-primary mb-1.5" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
        />
      </div>
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
        <label className="block text-sm font-semibold text-ink-primary mb-1.5" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
        />
      </div>
      {state?.error && <p className="text-sm text-danger-red">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors disabled:opacity-60"
      >
        {pending ? "Creating your business…" : "Create business"}
      </button>
    </form>
  );
}
