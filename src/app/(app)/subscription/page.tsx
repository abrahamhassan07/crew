import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBillingState } from "@/lib/billing";
import { SubscriptionPageClient } from "@/components/SubscriptionPageClient";

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", viewer.orgId).single();
  const billing = getBillingState(org);

  return (
    <SubscriptionPageClient
      currentPlan={org?.plan ?? null}
      status={org?.subscription_status ?? null}
      renews={org?.current_period_end ?? null}
      trialDaysLeft={billing.kind === "trial" ? billing.daysLeft : null}
      exempt={billing.kind === "exempt"}
      checkoutResult={typeof sp.checkout === "string" ? sp.checkout : null}
    />
  );
}
