"use client";

import { useActionState } from "react";
import { setPassword } from "./actions";

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-semibold mb-1" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
        />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 px-4 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
