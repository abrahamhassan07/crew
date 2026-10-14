"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Info, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ToastBanner, useToast } from "@/components/Toast";
import { PLANS, TEAM_SIZES, priceFor } from "@/lib/plans";

// Persists a single string value to localStorage and keeps every subscriber
// in the tab in sync (localStorage's own "storage" event only fires in
// *other* tabs, so same-tab writes are broadcast via a custom event).
// useSyncExternalStore is the React-supported way to read a mutable
// external source without a hydration mismatch (getServerSnapshot covers
// the server render, which has no localStorage) or an effect+setState.
const LS_EVENT = "crew:ls-update";

function subscribeToStorage(callback: () => void) {
  window.addEventListener(LS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useLocalStorageState(key: string, defaultValue: string): [string, (next: string) => void] {
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);
  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribeToStorage, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // ignore blocked/unavailable storage (e.g. private browsing)
      }
      window.dispatchEvent(new Event(LS_EVENT));
    },
    [key]
  );

  return [value, setValue];
}

type CompareCell = number | string;
interface CompareRow {
  section?: string;
  label?: string;
  cells?: CompareCell[];
}

const COMPARE: CompareRow[] = [
  { section: "Clients & jobs" },
  { label: "Clients and properties", cells: ["Unlimited", "Unlimited", "Unlimited"] },
  { label: "Users included", cells: ["Up to 5", "Unlimited", "Unlimited"] },
  { label: "Quotes, jobs and tax invoices", cells: [1, 1, 1] },
  { label: "Recurring jobs", cells: [0, 1, 1] },
  { label: "Crew view and drag-and-drop scheduling", cells: [0, 1, 1] },
  { section: "Operations" },
  { label: "Job checklists and photos", cells: [0, 1, 1] },
  { label: "Online booking requests", cells: [0, 1, 1] },
  { label: "Equipment tracking", cells: [0, 0, 1] },
  { label: "Custom roles and permissions", cells: [0, 0, 1] },
  { section: "Insights & growth" },
  { label: "Standard reports", cells: [1, 1, 1] },
  { label: "Crew utilisation reports", cells: [0, 0, 1] },
  { label: "Marketing campaigns", cells: [0, 0, 1] },
  { label: "Support", cells: ["Email", "Email & chat", "Priority"] },
];

export interface SubscriptionPageProps {
  currentPlan: string | null;
  status: string | null;
  renews: string | null;
  trialDaysLeft: number | null;
  exempt: boolean;
  checkoutResult: string | null;
}

export function SubscriptionPageClient({ currentPlan, status, renews, trialDaysLeft, exempt, checkoutResult }: SubscriptionPageProps) {
  const { toast, showToast } = useToast();
  const [teamKey, setTeamKey] = useLocalStorageState("crew_subscription_team", "1");
  const [annualStr, setAnnualStr] = useLocalStorageState("crew_subscription_annual", "true");
  const [busy, setBusy] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const annual = annualStr === "true";
  const setAnnual = (v: boolean) => setAnnualStr(String(v));

  const team = TEAM_SIZES.find((t) => t.k === teamKey) ?? TEAM_SIZES[0];
  const curRank = PLANS.find((p) => p.k === currentPlan)?.rank ?? 0;
  const subscribed = !!status && ["active", "trialing", "past_due"].includes(status);

  const go = async (url: string, body?: object) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        showToast(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("Couldn't reach the billing service. Please try again.");
      setBusy(false);
    }
  };
  const confirmPlan = PLANS.find((p) => p.k === confirmKey) ?? null;

  const cards = useMemo(
    () =>
      PLANS.map((p) => {
        const { monthly, now } = priceFor(p, team, annual);
        const isCurrent = subscribed && p.k === currentPlan;
        const recommended = p.k === "growth";
        const tooBig = team.users > p.max;
        const isUpgrade = p.rank > curRank;
        return { plan: p, monthly, now, isCurrent, recommended, tooBig, isUpgrade };
      }),
    [team, annual, currentPlan, curRank, subscribed]
  );

  const confirmPrice = confirmPlan ? priceFor(confirmPlan, team, annual) : null;

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8">
        <div className="max-w-[1360px] mx-auto">
          {checkoutResult === "success" && (
            <div className="px-4 py-3 bg-ok-bg text-ok-fg rounded-lg text-sm font-semibold mb-6">Thanks! Your subscription is being set up and will show here in a moment.</div>
          )}
          {exempt ? (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-info-bg text-info-fg rounded-lg text-sm mb-6">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your account is on a complimentary plan, so there&rsquo;s nothing to pay. The plans below are what new businesses see.</span>
            </div>
          ) : subscribed ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-card-bg border border-line rounded-lg text-sm mb-6">
              <span>
                <strong className="capitalize">{currentPlan ?? "Your"} plan</strong> · {status === "past_due" ? "payment overdue" : status === "trialing" ? "trial" : "active"}
                {renews ? ` · renews ${new Date(renews).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </span>
              <Button variant="secondary" disabled={busy} onClick={() => go("/api/billing/portal")}>Manage billing</Button>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-info-bg text-info-fg rounded-lg text-sm mb-6">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {trialDaysLeft != null
                  ? `You're on a free trial with ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left. Pick a plan any time — you won't be charged until your trial ends.`
                  : "Your free trial has ended. Choose a plan to keep using Crew & Grounds."}
              </span>
            </div>
          )}

          <h1 className="text-3xl font-extrabold tracking-tight text-ink-primary">Choose your plan</h1>
          <p className="text-base text-ink-secondary mt-2 mb-6 max-w-2xl">Pick the plan and team size that suit your business. You can change or cancel any time from Manage billing.</p>

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

            <div className="flex items-center gap-2.5">
              <span className="text-sm text-ink-secondary">Billing</span>
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
            </div>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-ok-bg text-ok-fg text-sm font-semibold">
              <Tag className="w-3.5 h-3.5" />
              Save 20% with annual billing
            </span>

            <div className="flex-1" />
            <span className="text-sm text-ink-secondary">Prices in AUD, inc. GST</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 mb-10">
            {cards.map(({ plan, monthly, now, isCurrent, recommended, tooBig, isUpgrade }) => (
              <div
                key={plan.k}
                className="bg-card-bg rounded-xl p-6 flex flex-col relative"
                style={{ border: isCurrent ? "2px solid var(--color-ink-primary)" : recommended ? "2px solid var(--color-brand)" : "1px solid var(--color-line)" }}
              >
                <div className="flex justify-between items-center gap-2">
                  <h2 className="text-2xl font-extrabold tracking-tight">{plan.name}</h2>
                  {(isCurrent || recommended) && (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${isCurrent ? "bg-ink-primary text-white" : "bg-ok-bg text-ok-fg"}`}
                    >
                      {isCurrent ? "Current plan" : "Recommended"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-secondary mt-2 leading-relaxed min-h-[44px]">{plan.blurb}</p>

                <div className="mt-5 min-h-[22px]">
                  {annual && <span className="text-base font-bold text-ink-muted line-through">${monthly}/mo</span>}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[42px] font-extrabold tracking-tight leading-none">${now}</span>
                  <span className="text-base text-ink-secondary">/mo</span>
                </div>
                <div className="text-sm text-ink-muted mt-0.5">
                  {(team.users === 1 ? "1 user" : team.label)} · {annual ? `billed annually ($${now * 12}/yr)` : "billed monthly"}
                </div>

                <div className="text-sm font-bold mt-5 mb-2.5">{plan.lead}</div>
                <div className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f) => (
                    <div key={f} className="flex gap-2.5 text-sm leading-snug">
                      <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {tooBig && <div className="text-xs text-warn-fg mt-3.5">Starter supports up to 5 users. Choose Growth or Professional for larger teams.</div>}

                <Button
                  variant={isCurrent || tooBig ? "secondary" : isUpgrade ? "primary" : "secondary"}
                  size="lg"
                  disabled={isCurrent || tooBig || exempt}
                  onClick={() => (subscribed ? go("/api/billing/portal") : setConfirmKey(plan.k))}
                  className="mt-5.5 w-full"
                >
                  {isCurrent ? "Current plan" : tooBig ? "Not available for this team size" : subscribed ? (isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`) : `Choose ${plan.name}`}
                </Button>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-extrabold mb-3.5">Compare features</h2>
          <div className="bg-card-bg border border-line rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[680px]">
                <thead>
                  <tr>
                    <th className="text-left px-5 py-3.5 border-b border-line text-xs font-semibold text-ink-muted">Feature</th>
                    {PLANS.map((p) => (
                      <th key={p.k} className="text-center px-3 py-3.5 border-b border-line text-sm font-bold w-[170px]">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row, i) =>
                    row.section ? (
                      <tr key={i}>
                        <td colSpan={4} className="px-5 py-3 border-b border-line-soft text-sm font-bold bg-page-bg text-ink-muted">
                          {row.section}
                        </td>
                      </tr>
                    ) : (
                      <tr key={i}>
                        <td className="px-5 py-3 border-b border-line-soft text-sm">{row.label}</td>
                        {row.cells?.map((c, ci) => (
                          <td key={ci} className="px-3 py-3 border-b border-line-soft text-center text-sm">
                            {c === 1 ? (
                              <Check className="w-4 h-4 text-brand inline-block" />
                            ) : c === 0 ? (
                              <span className="text-ink-muted">—</span>
                            ) : (
                              <span className="font-semibold">{c}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {confirmPlan && confirmPrice && (
        <>
          <div onClick={() => setConfirmKey(null)} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <div className="bg-card-bg rounded-xl w-full max-w-sm p-6">
              <div className="text-lg font-extrabold mb-1.5">Subscribe to {confirmPlan.name}?</div>
              <div className="text-sm text-ink-secondary leading-relaxed mb-1.5">
                ${confirmPrice.now}/mo, {(team.users === 1 ? "1 user" : team.label).toLowerCase()}, {annual ? `billed annually ($${confirmPrice.now * 12}/yr)` : "billed monthly"}.
              </div>
              <div className="text-xs text-ink-muted leading-relaxed mb-5">
                You&rsquo;ll be taken to our payment partner, Stripe, to enter your card.
                {trialDaysLeft != null && trialDaysLeft > 1 ? ` Your free trial continues — you won't be charged until it ends.` : ""}
              </div>
              <div className="flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setConfirmKey(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={busy} onClick={() => go("/api/billing/checkout", { plan: confirmPlan.k, team: team.k, annual })}>
                  {busy ? "Redirecting…" : "Continue to payment"}
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
