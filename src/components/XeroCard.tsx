"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { disconnectXeroAction, saveXeroSettings } from "@/app/(app)/xeroActions";

export interface XeroSettingsView {
  /** The app has Xero credentials (the platform owner set it up). */
  available: boolean;
  /** The business's plan includes Xero (Team plan and above). */
  allowed: boolean;
  connected: boolean;
  tenantName: string;
  salesAccountCode: string;
  autoSync: boolean;
  accounts: { code: string; name: string }[];
  /** The connection includes the payments scope (connections made before payments sync need to reconnect once). */
  paymentScope: boolean;
  bankAccounts: { id: string; name: string }[];
  bankAccountId: string | null;
  bankAccountName: string | null;
  /** Xero notifies us of payments as they happen (webhook set up); otherwise they're checked once a day. */
  webhookLive: boolean;
  accountsFailed: boolean;
}

const RESULT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Xero is connected.", ok: true },
  declined: { text: "Xero wasn't connected: access was declined.", ok: false },
  error: { text: "We couldn't connect to Xero. Please try again.", ok: false },
  unavailable: { text: "Xero isn't available right now.", ok: false },
  plan: { text: "Xero is included with the Team plan and above.", ok: false },
};

/** Settings card for the Xero integration: connect, pick the sales account, turn auto-sync on or off, disconnect. */
export function XeroCard({ xero, result }: { xero: XeroSettingsView; result?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(xero.salesAccountCode);
  const [autoSync, setAutoSync] = useState(xero.autoSync);
  const [bank, setBank] = useState(xero.bankAccountId ?? "");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(result ? (RESULT_MESSAGES[result] ?? null) : null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (patch: { salesAccountCode?: string; autoSync?: boolean; bankAccountId?: string | null }, undo: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveXeroSettings(patch);
      if (!res.ok) {
        undo();
        setMessage({ text: res.error ?? "Couldn't save that.", ok: false });
        return;
      }
      setMessage({ text: "Saved.", ok: true });
    });
  };

  const disconnect = () => {
    startTransition(async () => {
      const res = await disconnectXeroAction();
      if (!res.ok) {
        setMessage({ text: res.error ?? "Couldn't disconnect.", ok: false });
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  const options = xero.accounts.some((a) => a.code === code) ? xero.accounts : [{ code, name: "Current account" }, ...xero.accounts];

  return (
    <CollapsibleCard
      className="xl:col-span-2"
      title="Xero"
      summary={!xero.allowed ? "Included with the Team plan and above" : xero.connected ? `Connected to ${xero.tenantName}` : "Not connected"}
      defaultOpen={!!result}
    >
      <div className="pt-3 space-y-4">
        {message && <p className={`text-sm ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</p>}

        {!xero.allowed ? (
          <>
            <p className="text-sm text-ink-muted">
              Connect Xero and every invoice you send is also created in Xero, with the client, line items and GST filled in. Xero is included with the Team plan (2–5 users) and above.
              {xero.connected && " Your connection is paused until your plan includes it again."}
            </p>
            <Link href="/subscription">
              <Button variant="primary" type="button">See plans</Button>
            </Link>
          </>
        ) : !xero.connected ? (
          <>
            <p className="text-sm text-ink-muted">
              Connect your Xero organisation and every invoice you send from Crew &amp; Grounds is also created in Xero, with the client, line items and GST filled in, and payments
              sync both ways. Crew &amp; Grounds only reads your account lists and the payments on invoices it sent.
            </p>
            {xero.available ? (
              // A full page navigation: the connection starts on Xero's own sign-in page.
              <a href="/api/xero/connect">
                <Button variant="primary" type="button">Connect Xero</Button>
              </a>
            ) : (
              <p className="text-sm text-ink-muted">Xero isn&rsquo;t available on this site yet.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Invoices you send are copied into <strong className="text-ink-primary">{xero.tenantName}</strong>. Drafts stay in Crew &amp; Grounds until they&rsquo;re sent.
            </p>

            <div className="max-w-md">
              {xero.accountsFailed ? (
                <TextField
                  label="Sales account code"
                  help="Couldn't load your accounts from Xero. Enter the account code invoice lines should be booked to (e.g. 200)."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onBlur={() => code !== xero.salesAccountCode && save({ salesAccountCode: code }, () => setCode(xero.salesAccountCode))}
                />
              ) : (
                <SelectField
                  label="Sales account"
                  help="Invoice lines are booked to this account in Xero."
                  value={code}
                  disabled={pending}
                  onChange={(e) => {
                    const previous = code;
                    setCode(e.target.value);
                    save({ salesAccountCode: e.target.value }, () => setCode(previous));
                  }}
                  options={options.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))}
                />
              )}
            </div>

            <label className="flex items-start gap-2.5 text-sm text-ink-primary cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={autoSync}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAutoSync(next);
                  save({ autoSync: next }, () => setAutoSync(!next));
                }}
              />
              <span>
                <span className="font-semibold">Send invoices to Xero automatically</span>
                <span className="block text-xs text-ink-muted">When off, use the &ldquo;Send to Xero&rdquo; button on each invoice.</span>
              </span>
            </label>

            <div className="rounded-lg border border-line p-4 space-y-3">
              <div className="text-sm font-semibold text-ink-primary">Payments</div>
              {!xero.paymentScope ? (
                <>
                  <p className="text-sm text-ink-muted">
                    Payments can now sync both ways: payments you record here are added to Xero, and payments recorded in Xero (for example when you reconcile your bank feed) show up here. Reconnect Xero once to allow it.
                  </p>
                  <a href="/api/xero/connect">
                    <Button variant="secondary" size="sm" type="button">Reconnect Xero</Button>
                  </a>
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    Payments recorded in Xero show up here {xero.webhookLive ? "within a minute or so" : "once a day, or straight away when you press \u201cResync to Xero\u201d on an invoice"}, and mark the invoice paid.
                  </p>
                  <div className="max-w-md">
                    <SelectField
                      label="Send payments recorded here to"
                      help="The Xero bank account the money was paid into. Choose “Don’t send” to record payments in Xero yourself."
                      value={bank}
                      disabled={pending || xero.accountsFailed}
                      onChange={(e) => {
                        const previous = bank;
                        setBank(e.target.value);
                        save({ bankAccountId: e.target.value || null }, () => setBank(previous));
                      }}
                      options={[{ value: "", label: "Don\u2019t send payments to Xero" }, ...xero.bankAccounts.map((a) => ({ value: a.id, label: a.name }))]}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-1">
              {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-secondary">Disconnect Xero? Invoices already in Xero stay there.</span>
                  <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={pending}>Keep connected</Button>
                  <Button variant="danger" size="sm" onClick={disconnect} disabled={pending}>Disconnect</Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>Disconnect Xero</Button>
              )}
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}
