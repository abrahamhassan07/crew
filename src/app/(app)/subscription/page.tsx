import { requireAdmin } from "@/lib/auth";

export default async function SubscriptionPage() {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-ink-primary">Subscription</h1>
          <p className="text-sm text-ink-secondary mt-1">Manage your plan and billing.</p>
        </div>
      </div>
      <div className="px-6 py-16">
        <div className="max-w-7xl mx-auto text-center">
          <div className="bg-info-bg border border-info-fg/20 rounded-lg p-8 inline-block">
            <h2 className="text-lg font-bold text-info-fg mb-2">Coming Soon</h2>
            <p className="text-sm text-info-fg/80">Plan management is in development. No billing provider is connected yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
