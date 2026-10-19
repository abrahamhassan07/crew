import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { SettingsPageClient } from "@/components/SettingsPageClient";
import type { XeroSettingsView } from "@/components/XeroCard";
import { getConnection, listSalesAccounts, xeroConfigured } from "@/lib/xero";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: organization }, connection] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", viewer.orgId).single(),
    getConnection(viewer.orgId),
  ]);

  if (!organization) return null;

  let accounts: XeroSettingsView["accounts"] = [];
  let accountsFailed = false;
  if (connection) {
    try {
      accounts = await listSalesAccounts(viewer.orgId);
    } catch {
      accountsFailed = true;
    }
  }
  const xero: XeroSettingsView = {
    available: xeroConfigured(),
    connected: !!connection,
    tenantName: connection?.tenant_name ?? "",
    salesAccountCode: connection?.sales_account_code ?? "200",
    autoSync: connection?.auto_sync ?? true,
    accounts,
    accountsFailed: accountsFailed || (!!connection && accounts.length === 0),
  };

  return <SettingsPageClient organization={organization} xero={xero} xeroResult={typeof sp.xero === "string" ? sp.xero : undefined} />;
}
