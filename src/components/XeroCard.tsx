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
  /** The business's plan includes Xero (a paid plan). */
  allowed: boolean;
  connected: boolean;
  tenantName: string;
  salesAccountCode: string;
  autoSync: boolean;
  accounts: { code: string; name: string }[];
  accountsFailed: boolean;
}

const RESULT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Xero is connected.", ok: true },
  declined: { text: "Xero wasn't connected: access was declined.", ok: false },
  error: { text: "We couldn't connect to Xero. Please try again.", ok: false },
  unavailable: { text: "Xero isn't available right now.", ok: false },
  plan: { text: "Xero is included with a paid plan.", ok: false },
};

/** Settings card for the Xero integration: connect, pick the sales account, turn auto-sync on or off, disconnect. */
export function XeroCard({ xero, result }: { xero: XeroSettingsView; result?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(xero.salesAccountCode);
  const [autoSync, setAutoSync] = useState(xero.autoSync);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(result ? (RESULT_MESSAGES[result] ?? null) : null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (patch: { salesAccountCode?: string; autoSync?: boolean }, undo: () => void) => {
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
      summary={!xero.allowed ? "Included with a paid plan" : xero.connected ? `Connected to ${xero.tenantName}` : "Not connected"}
      defaultOpen={!!result}
    >
      <div className="pt-3 space-y-4">
        {message && <p className={`text-sm ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</p>}

        {!xero.allowed ? (
          <>
            <p className="text-sm text-ink-muted">
              Connect Xero and every invoice you send is also created in Xero, with the client, line items and GST filled in. Xero is included with a paid plan.
              {xero.connected && " Your connection is paused until your plan is active again."}
            </p>
            <Link href="/subscription">
              <Button variant="primary" type="button">Choose a plan</Button>
            </Link>
          </>
        ) : !xero.connected ? (
          <>
            <p className="text-sm text-ink-muted">
              Connect your Xero organisation and every invoice you send from Crew &amp; Grounds is also created in Xero, with the client, line items and GST filled in. Nothing is
              read from Xero except your list of sales accounts.
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
              Payments are still recorded here and aren&rsquo;t sent to Xero.
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
