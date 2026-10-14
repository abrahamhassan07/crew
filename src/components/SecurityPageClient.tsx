"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToastBanner, useToast } from "@/components/Toast";

interface Enrolment {
  factorId: string;
  qr: string;
  secret: string;
}

export function SecurityPageClient({ email }: { email: string }) {
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<{ id: string; createdAt: string } | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.[0];
    setFactor(verified ? { id: verified.id, createdAt: verified.created_at } : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load the current factor state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const startEnrol = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // A half-finished earlier attempt blocks a new one, so clear any unverified factors first.
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
    setBusy(false);
    if (enrolError || !data) {
      setError(enrolError?.message ?? "Couldn't start setup. Please try again.");
      return;
    }
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  };

  const confirmEnrol = async () => {
    if (!enrolment || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check the code in your app and try again.");
      setCode("");
      return;
    }
    setEnrolment(null);
    setCode("");
    showToast("Two-factor sign-in is on");
    await refresh();
  };

  const cancelEnrol = async () => {
    if (enrolment) await createClient().auth.mfa.unenroll({ factorId: enrolment.factorId });
    setEnrolment(null);
    setCode("");
    setError(null);
  };

  const turnOff = async () => {
    if (!factor) return;
    setBusy(true);
    setError(null);
    const { error: offError } = await createClient().auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    setConfirmOff(false);
    if (offError) {
      setError(offError.message);
      return;
    }
    showToast("Two-factor sign-in is off");
    await refresh();
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader title="Security" subtitle="Protect your account with a second step when you sign in." />
      <div className="px-6 py-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <Card className="p-6">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${factor ? "bg-ok-bg text-ok-fg" : "bg-neutral-bg text-ink-muted"}`}>
                {factor ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-ink-primary">Two-factor sign-in</h2>
                <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
                  {loading
                    ? "Checking…"
                    : factor
                      ? `On for ${email}. You'll enter a 6-digit code from your authenticator app each time you sign in.`
                      : "Off. When on, signing in needs your password and a 6-digit code from an authenticator app on your phone, so a stolen password alone isn't enough."}
                </p>
                {factor && <p className="text-xs text-ink-muted mt-1.5">Turned on {new Date(factor.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>}
              </div>
              {!loading && !enrolment && (
                <div className="shrink-0">
                  {factor ? (
                    <Button variant="secondary" size="sm" onClick={() => setConfirmOff(true)} disabled={busy}>
                      Turn off
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={startEnrol} disabled={busy}>
                      Turn on
                    </Button>
                  )}
                </div>
              )}
            </div>

            {enrolment && (
              <div className="mt-6 pt-6 border-t border-line-soft">
                <ol className="text-sm text-ink-secondary leading-relaxed list-decimal pl-5 flex flex-col gap-1.5 mb-5">
                  <li>Open an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or 1Password.</li>
                  <li>Scan this QR code (or type the key below into the app).</li>
                  <li>Enter the 6-digit code the app shows to finish.</li>
                </ol>
                <div className="flex flex-wrap items-start gap-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrolment.qr} alt="QR code to scan with your authenticator app" width={176} height={176} className="rounded-lg border border-line bg-white p-2" />
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-xs font-semibold text-ink-muted mb-1">Can&rsquo;t scan? Enter this key</div>
                    <code className="block text-sm font-mono break-all bg-page-bg border border-line rounded-md px-3 py-2 select-all">{enrolment.secret}</code>
                    <div className="text-xs font-semibold text-ink-muted mt-4 mb-1">6-digit code</div>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      aria-label="6-digit code"
                      className="w-40 px-3 py-2 rounded-md border border-field-border text-lg tracking-[0.35em] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                    <div className="flex gap-2.5 mt-4">
                      <Button variant="primary" size="sm" onClick={confirmEnrol} disabled={busy || code.length !== 6}>
                        {busy ? "Checking…" : "Turn on"}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={cancelEnrol} disabled={busy}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-danger-red mt-4">{error}</p>}
          </Card>

          <p className="text-xs text-ink-muted leading-relaxed">
            Keep your phone safe: if you lose access to your authenticator app you&rsquo;ll need to contact support to get back in.
          </p>
        </div>
      </div>

      {confirmOff && (
        <>
          <div onClick={() => !busy && setConfirmOff(false)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-card-bg rounded-xl w-full max-w-sm p-6">
              <div className="text-lg font-extrabold mb-1.5">Turn off two-factor sign-in?</div>
              <div className="text-sm text-ink-secondary leading-relaxed mb-5">Your account will only need your password to sign in. You can turn it back on any time.</div>
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setConfirmOff(false)} disabled={busy}>
                  Keep it on
                </Button>
                <Button variant="primary" onClick={turnOff} disabled={busy}>
                  {busy ? "Turning off…" : "Turn off"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastBanner message={toast} />
    </div>
  );
}
