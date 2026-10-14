"use client";

import { useState, useTransition } from "react";
import { updateOrganization, type OrganizationInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader title="Settings" subtitle="Manage your organisation settings and preferences." maxWidth="5xl" />

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Business Settings */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-4">
              Business Information
            </h2>
            <div className="space-y-4">
              <TextField
                label="Business Name"
                required
                value={input.name}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
              />
              <TextField
                label="Email"
                type="email"
                value={input.email}
                onChange={(e) => setInput({ ...input, email: e.target.value })}
              />
              <TextField
                label="Phone"
                type="tel"
                value={input.phone}
                onChange={(e) => setInput({ ...input, phone: e.target.value })}
              />
              <TextField
                label="Address"
                value={input.address}
                onChange={(e) => setInput({ ...input, address: e.target.value })}
              />
              <TextField
                label="ABN"
                placeholder="00 000 000 000"
                value={input.abn}
                onChange={(e) => setInput({ ...input, abn: e.target.value })}
                error={input.abn.trim() && !isValidAbn(input.abn) ? "That doesn't look like a valid 11-digit ABN." : undefined}
              />
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
          </Card>

          {/* Invoice payment details */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-1">Payment details</h2>
            <p className="text-sm text-ink-muted mb-4">How clients should pay you. This is pre-filled into the payment instructions on every new invoice (you can still change it per invoice).</p>
            <TextAreaField
              label="Payment instructions"
              rows={5}
              maxLength={1000}
              placeholder={"Account name: Your Business\nBSB: 000-000\nAccount number: 00000000\nPlease use the invoice number as your payment reference."}
              value={input.paymentDetails}
              onChange={(e) => setInput({ ...input, paymentDetails: e.target.value })}
            />
          </Card>

          {/* Email templates */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-1">Email templates</h2>
            <p className="text-sm text-ink-muted mb-5">
              The wording used when you email a quote or invoice. You can still edit each email before it&rsquo;s sent. Words in {"{braces}"} are filled in for each client.
            </p>
            {(["quote", "invoice"] as TemplateKind[]).map((kind) => {
              const subjectKey = kind === "quote" ? "quoteEmailSubject" : "invoiceEmailSubject";
              const bodyKey = kind === "quote" ? "quoteEmailBody" : "invoiceEmailBody";
              return (
                <div key={kind} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-ink-primary">{kind === "quote" ? "Quote email" : "Invoice email"}</h3>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand"
                      onClick={() => setInput({ ...input, [subjectKey]: DEFAULT_TEMPLATES[kind].subject, [bodyKey]: DEFAULT_TEMPLATES[kind].body })}
                    >
                      Reset to default
                    </button>
                  </div>
                  <div className="space-y-3">
                    <TextField label="Subject" maxLength={MAX_SUBJECT} value={input[subjectKey]} onChange={(e) => setInput({ ...input, [subjectKey]: e.target.value })} />
                    <TextAreaField label="Message" rows={9} maxLength={MAX_BODY} value={input[bodyKey]} onChange={(e) => setInput({ ...input, [bodyKey]: e.target.value })} />
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
            })}
          </Card>

          {/* Customer reminders */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-1">Customer reminders</h2>
            <p className="text-sm text-ink-muted mb-4">
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
              <p className="text-xs text-warn-fg mt-2">Add your business email above first. Reminders aren&rsquo;t sent without it, so customer replies have somewhere to go.</p>
            )}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-primary">Reminder email</h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand"
                  onClick={() => setInput({ ...input, reminderEmailSubject: DEFAULT_TEMPLATES.reminder.subject, reminderEmailBody: DEFAULT_TEMPLATES.reminder.body })}
                >
                  Reset to default
                </button>
              </div>
              <TextField label="Subject" maxLength={MAX_SUBJECT} value={input.reminderEmailSubject} onChange={(e) => setInput({ ...input, reminderEmailSubject: e.target.value })} />
              <TextAreaField label="Message" rows={8} maxLength={MAX_BODY} value={input.reminderEmailBody} onChange={(e) => setInput({ ...input, reminderEmailBody: e.target.value })} />
              <p className="text-xs text-ink-muted">
                Available:{" "}
                {PLACEHOLDERS.reminder.map((p, i) => (
                  <span key={p.key}>
                    {i > 0 && ", "}
                    <code className="text-ink-secondary">{`{${p.key}}`}</code> ({p.help})
                  </span>
                ))}
              </p>
            </div>
          </Card>

          {/* Pricing Settings */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-4">
              Pricing
            </h2>
            <div className="space-y-4">
              <SelectField
                label="GST Registration"
                value={input.gstRegistered ? "yes" : "no"}
                onChange={(e) => setInput({ ...input, gstRegistered: e.target.value === "yes" })}
                options={[
                  { value: "yes", label: "Yes, registered for GST" },
                  { value: "no", label: "No, not registered" },
                ]}
              />
              <p className="text-xs text-ink-muted -mt-2">
                {input.gstRegistered
                  ? "Quotes and invoices add or include 10% GST and invoices are titled Tax Invoice."
                  : "New quotes and invoices show no GST and are titled Invoice. Existing documents keep the GST setting they were issued with."}
              </p>
            </div>
          </Card>

          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          {saved && <p className="text-sm text-ok-fg mb-3">Saved.</p>}

          {/* Save button */}
          <div className="flex justify-end gap-3">
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
