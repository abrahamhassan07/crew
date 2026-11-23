"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/forms/SelectField";
import { disconnectPhAccountsAction, savePhAccountsSettings } from "@/app/(app)/phAccountsActions";

export interface PhAccountsSettingsView {
  /** The business's plan includes it (Team plan and above, same as Xero). */
  allowed: boolean;
  connected: boolean;
  /** Xero is connected: invoices go to one set of books at a time. */
  xeroConnected: boolean;
  businessName: string;
  /** PH Accounts allows this connection to send finished invoices; false = drafts for the business to issue. */
  canIssueInvoices: boolean;
  revenueAccountId: string | null;
  revenueAccountName: string | null;
  taxCodeId: string | null;
  taxCodeName: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  revenue: { id: string; name: string }[];
  taxCodes: { id: string; name: string }[];
  banks: { id: string; name: string }[];
  /** The lists couldn't be loaded from PH Accounts (or it asked for the business to connect again). */
  listsFailed: boolean;
  reconnectNeeded: boolean;
}

const RESULT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "PH Accounts is connected. Choose your sales account below.", ok: true },
  declined: { text: "PH Accounts wasn't connected: access was declined.", ok: false },
  error: { text: "We couldn't connect to PH Accounts. Please try again.", ok: false },
  unavailable: { text: "PH Accounts isn't available right now.", ok: false },
  plan: { text: "PH Accounts isn't part of your current plan.", ok: false },
  xero: { text: "Disconnect Xero first: invoices go to one set of books at a time.", ok: false },
};

/** Keeps the saved choice visible even if it's no longer in PH Accounts' list (e.g. the account was archived). */
function withCurrent(list: { id: string; name: string }[], id: string | null, name: string | null) {
  return id && !list.some((c) => c.id === id) ? [{ id, name: name ?? "Current choice" }, ...list] : list;
}

/** Settings card for "Connect to PH Accounts": connect, choose accounts, disconnect. */
export function PhAccountsCard({ ph, result }: { ph: PhAccountsSettingsView; result?: string }) {
  const router = useRouter();
  const [revenue, setRevenue] = useState(ph.revenueAccountId ?? "");
  const [taxCode, setTaxCode] = useState(ph.taxCodeId ?? "");
  const [bank, setBank] = useState(ph.bankAccountId ?? "");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(result ? (RESULT_MESSAGES[result] ?? null) : null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (choice: "revenue" | "taxCode" | "bank", id: string, undo: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await savePhAccountsSettings({ choice, id: id || null });
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
      const res = await disconnectPhAccountsAction();
      if (!res.ok) {
        setMessage({ text: res.error ?? "Couldn't disconnect.", ok: false });
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <CollapsibleCard
      className="xl:col-span-2"
      title="PH Accounts"
      summary={!ph.allowed ? <><span data-app-hide>Included with the Team plan and above</span><span data-app-only>Not part of your current plan</span></> : ph.connected ? `Connected to ${ph.businessName}` : "Not connected"}
      defaultOpen={!!result}
    >
      <div className="pt-3 space-y-4">
        {message && <p className={`text-sm ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</p>}

        {!ph.allowed ? (
          <>
            <p className="text-sm text-ink-muted">
              Connect PH Accounts and the invoices you send are also recorded in your books.<span data-app-hide> PH Accounts is included with the Team plan (2–5 users) and above.</span><span data-app-only> PH Accounts isn&apos;t part of your current plan.</span>
              {ph.connected && " Your connection is paused until your plan includes it again."}
            </p>
            <Link href="/subscription">
              <Button variant="primary" type="button">See plans</Button>
            </Link>
          </>
        ) : !ph.connected ? (
          <>
            <p className="text-sm text-ink-muted">
              Use PH Accounts for your bookkeeping? Connect it and the invoices you send from Crew &amp; Grounds are also recorded in PH Accounts, with the client, line items and GST filled in.
              You choose which business to connect, and you can disconnect at any time.
            </p>
            {ph.xeroConnected ? (
              <p className="text-sm text-ink-muted">Xero is connected. Disconnect Xero first: invoices go to one set of books at a time.</p>
            ) : (
              // A full page navigation: the connection is approved on PH Accounts' own page.
              <a href="/api/phaccounts/connect">
                <Button variant="primary" type="button">Connect to PH Accounts</Button>
              </a>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Connected to <strong className="text-ink-primary">{ph.businessName}</strong> in PH Accounts.
              {ph.canIssueInvoices
                ? " Invoices you send go straight into your books there."
                : " Invoices you send arrive there as drafts for you to check and send. To have them go straight into your books, reconnect and tick “can send finished invoices”."}
            </p>

            {ph.reconnectNeeded ? (
              <div className="space-y-2">
                <p className="text-sm text-danger">PH Accounts needs you to connect again (the person who connected it may no longer be an owner or admin there).</p>
                <a href="/api/phaccounts/connect">
                  <Button variant="primary" size="sm" type="button">Reconnect PH Accounts</Button>
                </a>
              </div>
            ) : ph.listsFailed ? (
              <p className="text-sm text-danger">Couldn&apos;t load your accounts from PH Accounts. Refresh the page to try again.</p>
            ) : (
              <div className="max-w-md space-y-4">
                <SelectField
                  label="Sales account"
                  help="Invoice lines are booked to this account in PH Accounts."
                  value={revenue}
                  disabled={pending}
                  onChange={(e) => {
                    const previous = revenue;
                    setRevenue(e.target.value);
                    save("revenue", e.target.value, () => setRevenue(previous));
                  }}
                  options={[
                    ...(revenue ? [] : [{ value: "", label: "Choose a sales account" }]),
                    ...withCurrent(ph.revenue, ph.revenueAccountId, ph.revenueAccountName).map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
                <SelectField
                  label="GST tax code"
                  help="Used on invoice lines that include GST. Invoices without GST are sent with no tax code."
                  value={taxCode}
                  disabled={pending}
                  onChange={(e) => {
                    const previous = taxCode;
                    setTaxCode(e.target.value);
                    save("taxCode", e.target.value, () => setTaxCode(previous));
                  }}
                  options={[{ value: "", label: "No GST code chosen" }, ...withCurrent(ph.taxCodes, ph.taxCodeId, ph.taxCodeName).map((t) => ({ value: t.id, label: t.name }))]}
                />
                <SelectField
                  label="Send payments recorded here to"
                  help="The bank account in PH Accounts the money was paid into. Choose “Don’t send” to record payments in PH Accounts yourself."
                  value={bank}
                  disabled={pending}
                  onChange={(e) => {
                    const previous = bank;
                    setBank(e.target.value);
                    save("bank", e.target.value, () => setBank(previous));
                  }}
                  options={[{ value: "", label: "Don’t send payments to PH Accounts" }, ...withCurrent(ph.banks, ph.bankAccountId, ph.bankAccountName).map((b) => ({ value: b.id, label: b.name }))]}
                />
              </div>
            )}

            <div className="pt-1">
              {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-secondary">Disconnect PH Accounts? Invoices already there stay there.</span>
                  <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={pending}>Keep connected</Button>
                  <Button variant="danger" size="sm" onClick={disconnect} disabled={pending}>Disconnect</Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>Disconnect PH Accounts</Button>
              )}
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}
