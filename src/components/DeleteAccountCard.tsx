"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { deleteMyAccount, getDeletionPlan } from "@/app/(app)/accountActions";
import type { DeletionPlan } from "@/lib/accountDeletion";

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border border-field-border text-base sm:text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-danger-red/20 focus:border-danger-red transition-all";

/**
 * Delete your account (required by Apple for apps that can create accounts, and useful on the web too). Explains
 * exactly what goes before anything happens; the server repeats every check.
 */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<DeletionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      setPlan(await getDeletionPlan());
    } catch {
      setError("Couldn't load your account details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setConfirmName("");
    setError(null);
  };

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteMyAccount({ password: password || undefined, confirmName });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      // The login no longer exists; clear this browser's copy and leave.
      await createClient().auth.signOut({ scope: "local" }).catch(() => {});
      // A full page load (not a client-side route change) so nothing from the deleted account stays in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?reason=deleted");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const business = plan?.kind === "business";
  const canSubmit = !!plan && !busy && (!plan.hasPassword || password.length > 0) && (!business || confirmName.trim().length > 0);

  return (
    <>
      <Card className="p-6">
        <h2 className="text-base font-bold text-ink-primary">Delete account</h2>
        <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
          Permanently delete your login. If you&rsquo;re the only owner or admin, your whole business is deleted with it.
        </p>
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={start}>
            <Trash2 className="w-4 h-4 mr-1.5 text-danger-red" />
            Delete my account…
          </Button>
        </div>
      </Card>

      {open && (
        <>
          <div onClick={close} className="fixed inset-0 bg-black/45 z-100" />
          <div className="fixed inset-0 z-101 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="bg-card-bg rounded-t-2xl sm:rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div id="delete-title" className="text-lg font-extrabold mb-2">
                {business ? "Delete your account and business?" : "Delete your account?"}
              </div>

              {loading && <p className="text-sm text-ink-secondary">Checking what would be deleted…</p>}

              {plan && (
                <div className="text-sm text-ink-secondary leading-relaxed space-y-3">
                  {plan.kind === "staff" && (
                    <p>
                      Your login is deleted and you won&rsquo;t be able to sign in to <strong className="text-ink-primary">{plan.businessName}</strong> again. Jobs you worked on stay with the business.
                    </p>
                  )}
                  {plan.kind === "admin" && (
                    <p>
                      Your login is deleted. <strong className="text-ink-primary">{plan.businessName}</strong> carries on with its {plan.otherAdmins === 1 ? "other owner or admin" : `${plan.otherAdmins} other owners or admins`}.
                    </p>
                  )}
                  {business && (
                    <>
                      <p>
                        You&rsquo;re the only owner or admin, so <strong className="text-ink-primary">{plan.businessName}</strong> is deleted too. This removes everything: clients, jobs, quotes, invoices, payments, photos and settings
                        {plan.staffLogins > 0 ? `, and the ${plan.staffLogins} staff login${plan.staffLogins === 1 ? "" : "s"} in this business` : ""}.
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        {plan.subscriptionActive && <li>Your subscription is cancelled straight away. You won&rsquo;t be charged again.</li>}
                        {plan.xeroConnected && <li>Xero is disconnected. Invoices already in Xero stay there.</li>}
                        <li>Download anything you need to keep (for example invoices for your records) before you continue.</li>
                      </ul>
                    </>
                  )}
                  <p className="font-semibold text-danger-red">This can&rsquo;t be undone.</p>

                  {plan.hasPassword ? (
                    <div>
                      <label htmlFor="delete-password" className="block text-sm font-semibold text-ink-primary mb-1.5">
                        Your password
                      </label>
                      <input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
                    </div>
                  ) : (
                    <p>You signed in with Apple or Google, so there&rsquo;s no password to check. If you signed in more than 15 minutes ago you&rsquo;ll be asked to sign in again first.</p>
                  )}

                  {business && (
                    <div>
                      <label htmlFor="delete-name" className="block text-sm font-semibold text-ink-primary mb-1.5">
                        Type <span className="select-all">{plan.businessName}</span> to confirm
                      </label>
                      <input id="delete-name" type="text" autoComplete="off" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className={inputClass} />
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-danger-red mt-3">{error}</p>}

              <div className="flex justify-end gap-2.5 mt-5">
                <Button variant="secondary" onClick={close} disabled={busy}>
                  Keep my account
                </Button>
                <Button variant="danger" onClick={confirm} disabled={!canSubmit}>
                  {busy ? "Deleting…" : business ? "Delete account and business" : "Delete account"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
