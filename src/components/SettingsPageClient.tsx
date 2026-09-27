"use client";

import { useState, useTransition } from "react";
import { updateOrganization, type OrganizationInput } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Organization } from "@/lib/supabase/types";

export function SettingsPageClient({ organization }: { organization: Organization }) {
  const [input, setInput] = useState<OrganizationInput>({
    name: organization.name,
    email: organization.email ?? "",
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    abn: organization.abn ?? "",
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

          {/* Pricing Settings */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-ink-primary mb-4">
              Pricing
            </h2>
            <div className="space-y-4">
              <SelectField
                label="GST Registration"
                options={[
                  { value: "yes", label: "Yes, registered" },
                  { value: "no", label: "No, not registered" },
                ]}
                defaultValue="yes"
              />
              <SelectField
                label="Price Display Mode"
                options={[
                  { value: "inclusive", label: "Inclusive of GST" },
                  { value: "exclusive", label: "Exclusive of GST" },
                ]}
                defaultValue="inclusive"
              />
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
