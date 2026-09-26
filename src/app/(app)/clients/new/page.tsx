import { requireAdmin } from "@/lib/auth";
import { ClientForm } from "@/components/ClientForm";

export default async function NewClientPage() {
  await requireAdmin();
  return <ClientForm mode="new" client={null} properties={[]} />;
}
