"use client";

import { useState, useTransition } from "react";
import { updateOrganization, type OrganizationInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { PageHeader } from "@/components/ui/PageHeader";
import { isValidAbn } from "@/lib/validate";
import { DEFAULT_TEMPLATES, MAX_BODY, MAX_SUBJECT, PLACEHOLDERS, templateFor, type TemplateKind } from "@/lib/emailTemplates";
import type { Organization } from "@/lib/supabase/types";

export function SettingsPageClient({ organization }: { organization: Organization }) {
  const [input, setInput] = useState<OrganizationInput>({
    name: organization.name,
    email: organization.email ?? "",
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    abn: organization.abn ?? "",
    gstRegistered: organization.gst_registered ?? true,
    paymentDetails: organization.payment_details ?? "",
    quoteEmailSubject: templateFor(organization, "quote").subject,
    quoteEmailBody: templateFor(organization, "quote").body,
    invoiceEmailSubject: templateFor(organization, "invoice").subject,
    invoiceEmailBody: templateFor(organization, "invoice").body,
    remindersEnabled: organization.reminders_enabled ?? false,
    reminderEmailSubject: templateFor(organization, "reminder").subject,
    reminderEmailBody: templateFor(organization, "reminder").body,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOrganization(input);
      if (!result.ok) {
        setError(result.error ?? "Could not save business information.");
        return;
      }
      setSaved(true);
    });
  };

  const templateChanged = (["quote", "invoice"] as const).some(
    (k) => input[`${k}EmailSubject`] !== DEFAULT_TEMPLATES[k].subject || input[`${k}EmailBody`] !== DEFAULT_TEMPLATES[k].body
  );
  const firstLine = input.paymentDetails.trim().split("\n")[0];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Settings"
        subtitle="Manage your organisation settings and preferences."
        actions={
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-danger max-w-xs text-right">{error}</span>}
            {saved && !error && <span className="text-sm text-ok-fg">Saved.</span>}
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      <div className="px-6 py-6">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <CollapsibleCard
            title="Business information"
            summary={[input.name, input.abn && `ABN ${input.abn}`, input.email].filter(Boolean).join(" · ")}
            defaultOpen
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5 pt-3">
              <TextField label="Business name" required value={input.name} onChange={(e) => setInput({ ...input, name: e.target.value })} />
              <TextField label="Email" type="email" value={input.email} onChange={(e) => setInput({ ...input, email: e.target.value })} />
              <TextField label="Phone" type="tel" value={input.phone} onChange={(e) => setInput({ ...input, phone: e.target.value })} />
              <TextField
                label="ABN"
                placeholder="00 000 000 000"
                value={input.abn}
                onChange={(e) => setInput({ ...input, abn: e.target.value })}
                error={input.abn.trim() && !isValidAbn(input.abn) ? "That doesn't look like a valid 11-digit ABN." : undefined}
              />
              <TextField label="Address" value={input.address} onChange={(e) => setInput({ ...input, address: e.target.value })} />
              <SelectField
                label="Timezone"
                options={[
                  { value: "Australia/Melbourne", label: "Melbourne (VIC)" },
                  { value: "Australia/Sydney", label: "Sydney (NSW)" },
                  { value: "Australia/Brisbane", label: "Brisbane (QLD)" },
                  { value: "Australia/Adelaide", label: "Adelaide (SA)" },
                  { value: "Australia/Perth", label: "Perth (WA)" },
                  { value: "Australia/Hobart", label: "Hobart (TAS)" },
                ]}
                defaultValue="Australia/Melbourne"
              />
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Payment details" summary={firstLine || "Not set yet"}>
            <p className="text-sm text-ink-muted mb-3 pt-3">How clients should pay you. This is pre-filled into the payment instructions on every new invoice (you can still change it per invoice).</p>
            <TextAreaField
              label="Payment instructions"
              rows={5}
              maxLength={1000}
              placeholder={"Account name: Your Business\nBSB: 000-000\nAccount number: 00000000\nPlease use the invoice number as your payment reference."}
              value={input.paymentDetails}
              onChange={(e) => setInput({ ...input, paymentDetails: e.target.value })}
            />
          </CollapsibleCard>

          <CollapsibleCard title="Pricing" summary={input.gstRegistered ? "Registered for GST" : "Not registered for GST"}>
            <div className="space-y-3 pt-3">
              <SelectField
                label="GST registration"
                value={input.gstRegistered ? "yes" : "no"}
                onChange={(e) => setInput({ ...input, gstRegistered: e.target.value === "yes" })}
                options={[
                  { value: "yes", label: "Yes, registered for GST" },
                  { value: "no", label: "No, not registered" },
                ]}
              />
              <p className="text-xs text-ink-muted">
                {input.gstRegistered
                  ? "Quotes and invoices add or include 10% GST and invoices are titled Tax Invoice."
                  : "New quotes and invoices show no GST and are titled Invoice. Existing documents keep the GST setting they were issued with."}
              </p>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Customer reminders" summary={input.remindersEnabled ? "On: customers are emailed the day before a job" : "Off"}>
            <p className="text-sm text-ink-muted mb-3 pt-3">
              Email customers the day before a scheduled job. Sent every morning for jobs happening tomorrow, only to clients with an email address, and only once per job.
            </p>
            <SelectField
              label="Reminders"
              value={input.remindersEnabled ? "on" : "off"}
              onChange={(e) => setInput({ ...input, remindersEnabled: e.target.value === "on" })}
              options={[
                { value: "off", label: "Off" },
                { value: "on", label: "On: remind customers the day before" },
              ]}
            />
            {input.remindersEnabled && !input.email.trim() && (
              <p className="text-xs text-warn-fg mt-2">Add your business email first. Reminders aren&rsquo;t sent without it, so customer replies have somewhere to go.</p>
            )}
            <div className="mt-4">
              <TemplateEditor kind="reminder" input={input} setInput={setInput} />
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            className="xl:col-span-2"
            title="Quote and invoice emails"
            summary={templateChanged ? "Custom wording" : "Using the default wording"}
          >
            <p className="text-sm text-ink-muted mb-4 pt-3">
              The wording used when you email a quote or invoice. You can still edit each email before it&rsquo;s sent. Words in {"{braces}"} are filled in for each client.
            </p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TemplateEditor kind="quote" input={input} setInput={setInput} />
              <TemplateEditor kind="invoice" input={input} setInput={setInput} />
            </div>
          </CollapsibleCard>
        </div>
      </div>
    </div>
  );
}

const TEMPLATE_KEYS = {
  quote: { subject: "quoteEmailSubject", body: "quoteEmailBody", title: "Quote email" },
  invoice: { subject: "invoiceEmailSubject", body: "invoiceEmailBody", title: "Invoice email" },
  reminder: { subject: "reminderEmailSubject", body: "reminderEmailBody", title: "Reminder email" },
} as const;

function TemplateEditor({ kind, input, setInput }: { kind: TemplateKind; input: OrganizationInput; setInput: (v: OrganizationInput) => void }) {
  const keys = TEMPLATE_KEYS[kind];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-ink-primary">{keys.title}</h3>
        <button
          type="button"
          className="text-xs font-semibold text-brand"
          onClick={() => setInput({ ...input, [keys.subject]: DEFAULT_TEMPLATES[kind].subject, [keys.body]: DEFAULT_TEMPLATES[kind].body })}
        >
          Reset to default
        </button>
      </div>
      <div className="space-y-3">
        <TextField label="Subject" maxLength={MAX_SUBJECT} value={input[keys.subject]} onChange={(e) => setInput({ ...input, [keys.subject]: e.target.value })} />
        <TextAreaField label="Message" rows={9} maxLength={MAX_BODY} value={input[keys.body]} onChange={(e) => setInput({ ...input, [keys.body]: e.target.value })} />
      </div>
      <p className="text-xs text-ink-muted mt-2">
        Available:{" "}
        {PLACEHOLDERS[kind].map((p, i) => (
          <span key={p.key}>
            {i > 0 && ", "}
            <code className="text-ink-secondary">{`{${p.key}}`}</code> ({p.help})
          </span>
        ))}
      </p>
    </div>
  );
}
