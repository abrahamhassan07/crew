"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MfaChallengeForm({ next, supportEmail }: { next: string; supportEmail: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp?.[0];
      if (!factor) {
        router.replace(next);
        return;
      }
      setFactorId(factor.id);
    })();
  }, [router, next]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setError("That code didn't work. Check your authenticator app and try again.");
      setCode("");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  };

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        aria-label="6-digit code"
        className="w-full px-3 py-3 rounded-lg border border-field-border text-center text-2xl tracking-[0.5em] font-semibold bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
      />
      {error && <p className="text-sm text-danger-red text-center">{error}</p>}
      <button
        type="submit"
        disabled={busy || !factorId || code.length !== 6}
        className="px-4 py-2.5 rounded-lg bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors disabled:opacity-60"
      >
        {busy ? "Checking…" : "Verify"}
      </button>
      <div className="text-xs text-ink-muted text-center leading-relaxed">
        Lost your phone? Email <a href={`mailto:${supportEmail}`} className="text-brand font-semibold">{supportEmail}</a> and we&rsquo;ll help you back in.
        <br />
        <button type="button" onClick={signOut} className="text-brand font-semibold mt-2">
          Sign out
        </button>
      </div>
    </form>
  );
}
