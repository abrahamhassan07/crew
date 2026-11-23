import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { SettingsPageClient } from "@/components/SettingsPageClient";
import type { XeroSettingsView } from "@/components/XeroCard";
import type { PhAccountsSettingsView } from "@/components/PhAccountsCard";
import type { AiSettingsView } from "@/components/AiFeaturesCard";
import { aiAllowed, aiMonthlyLimit, getBillingState } from "@/lib/billing";
import { aiUsageThisMonth } from "@/lib/ai/access";
import { getConnection, hasPaymentScope, listBankAccounts, listSalesAccounts, orgMayUseXero, xeroConfigured } from "@/lib/xero";
import { getConnection as getPhConnection, listPhChoices, PhApiError, phConfigured } from "@/lib/phAccounts";
import { needsReconnect } from "@/lib/phAccountsCore";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: organization }, connection] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", viewer.orgId).single(),
    getConnection(viewer.orgId),
  ]);

  if (!organization) return null;

  const allowed = await orgMayUseXero(viewer.orgId);
  let accounts: XeroSettingsView["accounts"] = [];
  let bankAccounts: XeroSettingsView["bankAccounts"] = [];
  let accountsFailed = false;
  const paymentScope = !!connection && hasPaymentScope(connection);
  if (connection && allowed) {
    try {
      [accounts, bankAccounts] = await Promise.all([listSalesAccounts(viewer.orgId), paymentScope ? listBankAccounts(viewer.orgId) : Promise.resolve([])]);
    } catch {
      accountsFailed = true;
    }
  }
  const xero: XeroSettingsView = {
    available: xeroConfigured(),
    allowed,
    connected: !!connection,
    tenantName: connection?.tenant_name ?? "",
    salesAccountCode: connection?.sales_account_code ?? "200",
    autoSync: connection?.auto_sync ?? true,
    accounts,
    paymentScope,
    bankAccounts,
    bankAccountId: connection?.bank_account_id ?? null,
    bankAccountName: connection?.bank_account_name ?? null,
    webhookLive: !!process.env.XERO_WEBHOOK_KEY,
    accountsFailed: accountsFailed || (!!connection && accounts.length === 0),
  };

  const ai: AiSettingsView = {
    allowed: aiAllowed(organization),
    monthlyLimit: aiMonthlyLimit(organization),
    usedThisMonth: await aiUsageThisMonth(viewer.orgId),
    onTrial: getBillingState(organization).kind === "trial",
    auditor: organization.ai_auditor_enabled,
    voiceQuote: organization.ai_voice_quote_enabled,
    voiceInvoice: organization.ai_voice_invoice_enabled,
    staffDrafts: organization.staff_drafts_enabled,
  };

  let ph: PhAccountsSettingsView | null = null;
  if (phConfigured()) {
    const phConn = await getPhConnection(viewer.orgId);
    let lists = { revenue: [] as PhAccountsSettingsView["revenue"], taxCodes: [] as PhAccountsSettingsView["taxCodes"], banks: [] as PhAccountsSettingsView["banks"] };
    let listsFailed = false;
    let reconnectNeeded = false;
    if (phConn && allowed) {
      try {
        lists = await listPhChoices(phConn);
      } catch (e) {
        listsFailed = true;
        reconnectNeeded = e instanceof PhApiError && needsReconnect(e.status, e.code);
      }
    }
    ph = {
      allowed,
      connected: !!phConn,
      xeroConnected: !!connection,
      businessName: phConn?.ph_org_name ?? "",
      canIssueInvoices: phConn?.can_issue_invoices ?? false,
      revenueAccountId: phConn?.revenue_account_id ?? null,
      revenueAccountName: phConn?.revenue_account_name ?? null,
      taxCodeId: phConn?.gst_tax_code_id ?? null,
      taxCodeName: phConn?.gst_tax_code_name ?? null,
      bankAccountId: phConn?.bank_account_id ?? null,
      bankAccountName: phConn?.bank_account_name ?? null,
      autoSync: phConn?.auto_sync ?? true,
      ...lists,
      listsFailed,
      reconnectNeeded,
    };
  }

  return (
    <SettingsPageClient
      organization={organization}
      xero={xero}
      ai={ai}
      xeroResult={typeof sp.xero === "string" ? sp.xero : undefined}
      ph={ph}
      phResult={typeof sp.phaccounts === "string" ? sp.phaccounts : undefined}
    />
  );
}
