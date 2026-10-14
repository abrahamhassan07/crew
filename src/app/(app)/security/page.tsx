import { getViewer } from "@/lib/auth";
import { SecurityPageClient } from "@/components/SecurityPageClient";

export default async function SecurityPage() {
  const viewer = await getViewer();
  return <SecurityPageClient email={viewer.email} />;
}
