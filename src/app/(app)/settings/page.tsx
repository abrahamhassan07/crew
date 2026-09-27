import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
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
                placeholder="Crew & Grounds"
                defaultValue="Crew & Grounds"
              />
              <TextField
                label="ABN"
                placeholder="00 000 000 000"
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

          {/* Save button */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary">Cancel</Button>
            <Button variant="primary" disabled>Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
