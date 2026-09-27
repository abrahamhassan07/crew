import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function MarketingPage() {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="Marketing"
        subtitle="Win repeat work and reviews from the clients you already have."
        actions={
          <Button variant="primary" size="md" disabled>
            <Plus className="w-4 h-4" />
            New campaign
          </Button>
        }
      />
      <div className="px-6 py-16">
        <div className="max-w-[1600px] mx-auto text-center">
          <div className="bg-info-bg border border-info-fg/20 rounded-lg p-8 inline-block">
            <h2 className="text-lg font-bold text-info-fg mb-2">Coming Soon</h2>
            <p className="text-sm text-info-fg/80">Marketing campaigns and review requests are in development.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
