import { requireAdmin } from "@/lib/auth";
import { SubscriptionPageClient } from "@/components/SubscriptionPageClient";

export default async function SubscriptionPage() {
  await requireAdmin();
  return <SubscriptionPageClient />;
}
