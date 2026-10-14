"use client";

import { useState } from "react";
import { Check, Info, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ToastBanner, useToast } from "@/components/Toast";
import { ANNUAL_DISCOUNT, PLAN, TEAM_SIZES, priceFor } from "@/lib/plans";

export interface SubscriptionPageProps {
  status: string | null;
  renews: string | null;
  trialDaysLeft: number | null;
  exempt: boolean;
  checkoutResult: string | null;
  teamSize: string | null;
  interval: "month" | "year" | null;
  seatsUsed: number;
  /** null = no limit */
  seatLimit: number | null;
}

export function SubscriptionPageClient({ status, renews, trialDaysLeft, exempt, checkoutResult, teamSize, interval, seatsUsed, seatLimit }: SubscriptionPageProps) {
  const { toast, showToast } = useToast();
  const subscribed = !!status && ["active", "trialing", "past_due"].includes(status);
  const currentTeam = TEAM_SIZES.find((t) => t.k === teamSize) ?? null;

  const [teamKey, setTeamKey] = useState<string>(teamSize ?? "1");
  const [annual, setAnnual] = useState(interval ? interval === "year" : true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const team = TEAM_SIZES.find((t) => t.k === teamKey) ?? TEAM_SIZES[0];
  const { monthly, now } = priceFor(team, annual);
  const changing = subscribed && currentTeam && team.k !== currentTeam.k;
  const tooSmall = seatsUsed > team.users;

  const post = async (url: string, body: object) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        setConfirming(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      showToast("Team size updated. It can take a few seconds to show here.");
      setConfirming(false);
      setBusy(false);
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      showToast("Couldn't reach the billing service. Please try again.");
      setBusy(false);
      setConfirming(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        showToast(data.error ?? "Couldn't open billing. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("Couldn't reach the billing service. Please try again.");
      setBusy(false);
    }
  };

  const cta = changing ? `Change to ${team.label}` : subscribed ? "Current team size" : "Subscribe";

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {checkoutResult === "success" && (
            <div className="px-4 py-3 bg-ok-bg text-ok-fg rounded-lg text-sm font-semibold mb-6">Thanks! Your subscription is being set up and will show here in a moment.</div>
          )}

          {exempt ? (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-info-bg text-info-fg rounded-lg text-sm mb-6">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your account is on a complimentary plan, so there&rsquo;s nothing to pay. This is what new businesses see.</span>
            </div>
          ) : subscribed ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-card-bg border border-line rounded-lg text-sm mb-6">
              <span>
                <strong>{PLAN.name}</strong>
                {currentTeam ? ` · ${currentTeam.label}` : ""} · {status === "past_due" ? "payment overdue" : status === "trialing" ? "trial" : "active"}
                {renews ? ` · renews ${new Date(renews).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </span>
              <Button variant="secondary" disabled={busy} onClick={openPortal}>
                Manage billing
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-info-bg text-info-fg rounded-lg text-sm mb-6">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {trialDaysLeft != null
                  ? `You're on a free trial with ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left. Subscribe any time. You won't be charged until your trial ends.`
                  : "Your free trial has ended. Subscribe to keep using Crew & Grounds."}
              </span>
            </div>
          )}

          <h1 className="text-3xl font-extrabold tracking-tight text-ink-primary">{subscribed ? "Your plan" : "Simple pricing"}</h1>
          <p className="text-base text-ink-secondary mt-2 mb-6 max-w-xl">{PLAN.blurb}</p>

          <div className="bg-card-bg border border-line rounded-xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3.5 mb-7">
              <label className="flex items-center gap-2.5">
                <span className="text-sm text-ink-secondary">Team size</span>
                <select
                  value={teamKey}
                  onChange={(e) => setTeamKey(e.target.value)}
                  className="h-[42px] border border-field-border rounded-md px-3 text-sm bg-card-bg text-ink-primary"
                >
                  {TEAM_SIZES.map((t) => (
                    <option key={t.k} value={t.k}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              {!subscribed && (
                <div role="radiogroup" className="flex border border-field-border rounded-md overflow-hidden bg-card-bg">
                  {([false, true] as const).map((v) => {
                    const on = annual === v;
                    return (
                      <button
                        key={String(v)}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setAnnual(v)}
                        className={`h-10 px-4 text-sm font-semibold transition-colors ${on ? "text-brand" : "text-ink-muted"}`}
                        style={on ? { boxShadow: "inset 0 0 0 2px var(--color-brand)" } : undefined}
                      >
                        {v ? "Annual" : "Monthly"}
                      </button>
                    );
                  })}
                </div>
              )}

              {!subscribed && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-ok-bg text-ok-fg text-sm font-semibold">
                  <Tag className="w-3.5 h-3.5" />
                  Save {Math.round(ANNUAL_DISCOUNT * 100)}% with annual billing
                </span>
              )}
            </div>

            <div className="mb-1 min-h-[22px]">{annual && !subscribed && <span className="text-base font-bold text-ink-muted line-through">${monthly}/mo</span>}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[48px] font-extrabold tracking-tight leading-none">${subscribed ? monthly : now}</span>
              <span className="text-base text-ink-secondary">/mo</span>
            </div>
            <div className="text-sm text-ink-muted mt-1">
              {team.users === 1 ? "1 user" : team.users >= 999 ? "21 or more users" : `up to ${team.users} users`} ·{" "}
              {subscribed ? (interval === "year" ? "billed annually" : "billed monthly") : annual ? `billed annually ($${now * 12}/yr)` : "billed monthly"} · prices in AUD
            </div>

            <div className="flex flex-col gap-2.5 mt-6 mb-7">
              {PLAN.features.map((f) => (
                <div key={f} className="flex gap-2.5 text-sm leading-snug">
                  <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {tooSmall && <div className="text-xs text-warn-fg mb-3">You have {seatsUsed} active users, which is more than {team.label.toLowerCase()} allows. Deactivate some in Crews &amp; Staff first.</div>}
            <Button variant="primary" size="lg" disabled={exempt || busy || tooSmall || (subscribed && !changing)} onClick={() => setConfirming(true)} className="w-full">
              {cta}
            </Button>
          </div>

          {!exempt && (
            <p className="text-sm text-ink-muted mt-4">
              {seatLimit === null ? `${seatsUsed} active user${seatsUsed === 1 ? "" : "s"}.` : `${seatsUsed} of ${seatLimit} users in use.`}
            </p>
          )}
        </div>
      </div>

      {confirming && (
        <>
          <div onClick={() => !busy && setConfirming(false)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-card-bg rounded-xl w-full max-w-sm p-6">
              <div className="text-lg font-extrabold mb-1.5">{changing ? `Change to ${team.label}?` : `Subscribe to ${PLAN.name}?`}</div>
              <div className="text-sm text-ink-secondary leading-relaxed mb-1.5">
                {changing
                  ? `$${monthly}/mo for ${team.users >= 999 ? "21 or more users" : `up to ${team.users} users`}.`
                  : `$${now}/mo, ${team.users === 1 ? "1 user" : team.users >= 999 ? "21 or more users" : `up to ${team.users} users`}, ${annual ? "billed annually" : "billed monthly"}.`}
              </div>
              <div className="text-xs text-ink-muted leading-relaxed mb-5">
                {changing
                  ? "The difference is charged or credited pro rata for the rest of your current billing period."
                  : `You'll be taken to our payment partner, Stripe, to enter your card.${trialDaysLeft != null && trialDaysLeft > 1 ? " Your free trial continues, so you won't be charged until it ends." : ""}`}
              </div>
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={busy} onClick={() => post(changing ? "/api/billing/change-team" : "/api/billing/checkout", changing ? { team: team.k } : { team: team.k, annual })}>
                  {busy ? "Working…" : changing ? "Confirm change" : "Continue to payment"}
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
