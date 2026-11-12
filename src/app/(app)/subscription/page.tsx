import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBillingState, invoiceLimit, seatLimit } from "@/lib/billing";
import { invoicesSentThisMonth } from "@/lib/usage";
import { SubscriptionPageClient } from "@/components/SubscriptionPageClient";
import { isAppRequest } from "@/lib/inApp";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: org }, { count: seatsUsed }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", viewer.orgId).single(),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  const billing = getBillingState(org);

  const invoicesUsed = await invoicesSentThisMonth(viewer.orgId);

  // App store rules: plans aren't bought or changed inside the phone app, so it only shows what you're on.
  if (await isAppRequest()) {
    const plan = billing.kind === "exempt" ? "Included" : billing.kind === "trial" ? `Free trial (${billing.daysLeft} day${billing.daysLeft === 1 ? "" : "s"} left)` : billing.kind === "free" ? "Free" : billing.plan ? billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1) : "Paid plan";
    return (
      <div>
        <PageHeader title="Subscription" />
        <div className="px-6 py-6 max-w-xl">
          <Card className="p-5 space-y-2">
            <p className="text-sm text-ink-secondary">Your plan</p>
            <p className="text-lg font-bold text-ink-primary">{plan}</p>
            <p className="text-sm text-ink-secondary">Plan changes aren&apos;t available in the app.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionPageClient
      status={org?.subscription_status ?? null}
      renews={org?.current_period_end ?? null}
      trialDaysLeft={billing.kind === "trial" ? billing.daysLeft : null}
      exempt={billing.kind === "exempt"}
      checkoutResult={typeof sp.checkout === "string" ? sp.checkout : null}
      teamSize={org?.team_size ?? null}
      interval={org?.billing_interval ?? null}
      seatsUsed={seatsUsed ?? 0}
      seatLimit={seatLimit(org)}
      invoicesUsed={invoicesUsed}
      invoiceLimit={invoiceLimit(org)}
      onFree={billing.kind === "free"}
    />
  );
}
