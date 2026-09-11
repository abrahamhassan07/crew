"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="block text-sm font-semibold mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
        />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 px-4 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
