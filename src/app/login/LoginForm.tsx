"use client";

import { useActionState, useState } from "react";
import { Sprout } from "lucide-react";
import { signIn } from "./actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { MfaChallengeForm } from "./mfa/MfaChallengeForm";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const OAUTH_ERRORS: Record<string, string> = {
  "oauth-failed": "Google sign-in failed. Please try again.",
  "no-account": "No account found for that Google email. Ask your admin to invite you, or create a new business.",
};

export function LoginForm({ next, oauthError, idle }: { next: string; oauthError?: string; idle?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@crewandgrounds.com";

  // Password accepted and the account has two-factor on: swap the form for the code step.
  const [googleNeedsCode, setGoogleNeedsCode] = useState(false);
  const needsCode = !!state?.mfa || googleNeedsCode;
  const heading = needsCode ? "Two-factor sign-in" : "Welcome back";
  const subheading = needsCode ? "Enter the 6-digit code from your authenticator app" : "Log in to your Crew & Grounds account";

  return (
    <>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-11 h-11 rounded-full bg-ok-bg text-ok-fg flex items-center justify-center mb-5">
          <Sprout className="w-5 h-5" />
        </div>
        <h1 className="font-serif font-semibold text-2xl text-ink-primary mb-1">{heading}</h1>
        <p className="text-sm text-ink-muted">{subheading}</p>
      </div>

      {idle && !needsCode && <p className="mb-4 rounded-lg bg-info-bg text-info-fg text-sm px-3 py-2.5 text-center">You were signed out after a while away. Please sign in again.</p>}

      {needsCode ? (
        <MfaChallengeForm next={next.startsWith("/") ? next : "/"} supportEmail={supportEmail} onSignOut={() => window.location.reload()} />
      ) : (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton next={next} onError={setGoogleError} onNeedsCode={() => setGoogleNeedsCode(true)} />

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
        <TurnstileWidget resetKey={state} />
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
      )}

      {!needsCode && (
        <p className="text-sm text-ink-muted text-center mt-6">
          New business?{" "}
          <a href="/signup" className="text-brand font-semibold">
            Sign up
          </a>
        </p>
      )}
    </>
  );
}
