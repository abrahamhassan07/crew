"use client";

import { useState } from "react";
import { Check, Info, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ToastBanner, useToast } from "@/components/Toast";
import { ANNUAL_DISCOUNT, PLAN, POPULAR_TEAM, TEAM_SIZES, perUser, priceFor, type TeamSize } from "@/lib/plans";

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
  emailsUsed: number;
  /** null = no limit */
  emailLimit: number | null;
}

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@crewandgrounds.com";

export function SubscriptionPageClient({ status, renews, trialDaysLeft, exempt, checkoutResult, teamSize, interval, seatsUsed, seatLimit, emailsUsed, emailLimit }: SubscriptionPageProps) {
  const { toast, showToast } = useToast();
  const subscribed = !!status && ["active", "trialing", "past_due"].includes(status);
  const currentTeam = TEAM_SIZES.find((t) => t.k === teamSize) ?? null;

  const [annual, setAnnual] = useState(interval ? interval === "year" : true);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<TeamSize | null>(null);

  const changing = subscribed && !!chosen && chosen.k !== currentTeam?.k;
  const billedAnnually = subscribed ? interval === "year" : annual;

  const post = async (url: string, body: object) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        setChosen(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      showToast("Team size updated. It can take a few seconds to show here.");
      setChosen(null);
      setBusy(false);
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      showToast("Couldn't reach the billing service. Please try again.");
      setBusy(false);
      setChosen(null);
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

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
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
                {currentTeam ? ` ${currentTeam.name}` : ""} · {status === "past_due" ? "payment overdue" : status === "trialing" ? "trial" : "active"}
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
          <p className="text-base text-ink-secondary mt-2 mb-6 max-w-2xl">Every plan includes everything. You only pay for the size of your team, and a bigger team costs less per person.</p>

          {!subscribed && (
            <div className="flex flex-wrap items-center gap-3.5 mb-6">
              <div role="radiogroup" className="flex border border-field-border rounded-md overflow-hidden bg-card-bg">
                {([false, true] as const).map((v) => {
                  const on = annual === v;
                  return (
                    <button
                      key={String(v)}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnnual(v)}
                      className={`h-10 px-4.5 text-sm font-semibold transition-colors ${on ? "text-brand" : "text-ink-muted"}`}
                      style={on ? { boxShadow: "inset 0 0 0 2px var(--color-brand)" } : undefined}
                    >
                      {v ? "Annual" : "Monthly"}
                    </button>
                  );
                })}
              </div>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-ok-bg text-ok-fg text-sm font-semibold">
                <Tag className="w-3.5 h-3.5" />
                Save {Math.round(ANNUAL_DISCOUNT * 100)}% with annual billing
              </span>
              <div className="flex-1" />
              <span className="text-sm text-ink-secondary">Prices in AUD</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
            {TEAM_SIZES.map((t) => {
              const { monthly, now } = priceFor(t, billedAnnually);
              const isCurrent = subscribed && currentTeam?.k === t.k;
              const popular = t.k === POPULAR_TEAM;
              const tooSmall = seatsUsed > t.users;
              const yearlySaving = monthly * 12 - priceFor(t, true).now * 12;
              return (
                <div
                  key={t.k}
                  className="bg-card-bg rounded-xl p-6 flex flex-col"
                  style={{ border: isCurrent ? "2px solid var(--color-ink-primary)" : popular ? "2px solid var(--color-brand)" : "1px solid var(--color-line)" }}
                >
                  <div className="flex justify-between items-center gap-2">
                    <h2 className="text-2xl font-extrabold tracking-tight">{t.name}</h2>
                    {(isCurrent || popular) && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${isCurrent ? "bg-ink-primary text-white" : "bg-ok-bg text-ok-fg"}`}>
                        {isCurrent ? "Current plan" : "Most popular"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-secondary mt-1">{t.users === 1 ? "Just you" : `Up to ${t.users} users`}</div>

                  <div className="mt-5 min-h-[22px]">{billedAnnually && <span className="text-base font-bold text-ink-muted line-through">${monthly}/mo</span>}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[44px] font-extrabold tracking-tight leading-none">${now}</span>
                    <span className="text-base text-ink-secondary">/mo</span>
                  </div>
                  <div className="text-sm text-ink-muted mt-1">{billedAnnually ? `billed annually ($${now * 12}/yr)` : "billed monthly"}</div>

                  <div className="mt-4 rounded-lg bg-page-bg px-3.5 py-3 text-sm flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-ink-secondary">Per user</span>
                      <span className="font-semibold">{t.users === 1 ? perUser(t) : `${perUser(t)} when full`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-secondary">Annual saves you</span>
                      <span className="font-semibold">${yearlySaving}/yr</span>
                    </div>
                  </div>

                  <div className="text-xs font-bold uppercase tracking-wide text-ink-muted mt-5 mb-2.5">Everything included</div>
                  <div className="flex flex-col gap-2.5 flex-1">
                    {PLAN.features.map((f) => (
                      <div key={f} className="flex gap-2.5 text-sm leading-snug">
                        <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  {tooSmall && !isCurrent && <div className="text-xs text-warn-fg mt-3.5">You have {seatsUsed} active users, more than this allows. Deactivate some in Crews &amp; Staff first.</div>}
                  <Button
                    variant={isCurrent ? "secondary" : popular ? "primary" : "secondary"}
                    size="lg"
                    disabled={exempt || busy || isCurrent || tooSmall}
                    onClick={() => setChosen(t)}
                    className="mt-5.5 w-full"
                  >
                    {isCurrent ? "Current plan" : subscribed ? `Switch to ${t.name}` : `Choose ${t.name}`}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-ink-secondary mt-5">
            Need 11 or more users? <a href={`mailto:${SUPPORT_EMAIL}?subject=Crew%20%26%20Grounds%20for%20a%20larger%20team`} className="text-brand font-semibold">Contact us</a> and we&rsquo;ll set you up with a price that fits.
          </p>
          {!exempt && (
            <div className="text-sm text-ink-muted mt-2 flex flex-col gap-0.5">
              <p>{seatLimit === null ? `${seatsUsed} active user${seatsUsed === 1 ? "" : "s"}.` : `You're using ${seatsUsed} of ${seatLimit} users.`}</p>
              <p>{emailLimit === null ? `${emailsUsed} quote${emailsUsed === 1 ? "" : "s"} and invoice${emailsUsed === 1 ? "" : "s"} emailed this month.` : `${emailsUsed} of ${emailLimit} quotes and invoices emailed this month.`}</p>
            </div>
          )}
        </div>
      </div>

      {chosen && (
        <>
          <div onClick={() => !busy && setChosen(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-card-bg rounded-xl w-full max-w-sm p-6">
              <div className="text-lg font-extrabold mb-1.5">{changing ? `Switch to ${chosen.name}?` : `Subscribe to ${chosen.name}?`}</div>
              <div className="text-sm text-ink-secondary leading-relaxed mb-1.5">
                {changing
                  ? `$${priceFor(chosen, billedAnnually).now}/mo for ${chosen.users === 1 ? "1 user" : `up to ${chosen.users} users`}.`
                  : `$${priceFor(chosen, annual).now}/mo, ${chosen.users === 1 ? "1 user" : `up to ${chosen.users} users`}, ${annual ? "billed annually" : "billed monthly"}.`}
              </div>
              <div className="text-xs text-ink-muted leading-relaxed mb-5">
                {changing
                  ? "The difference is charged or credited pro rata for the rest of your current billing period."
                  : `You'll be taken to our payment partner, Stripe, to enter your card.${trialDaysLeft != null && trialDaysLeft > 1 ? " Your free trial continues, so you won't be charged until it ends." : ""}`}
              </div>
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setChosen(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={busy} onClick={() => post(changing ? "/api/billing/change-team" : "/api/billing/checkout", changing ? { team: chosen.k } : { team: chosen.k, annual })}>
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
