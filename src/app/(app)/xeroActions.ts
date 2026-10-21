"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectXero, getConnection, listBankAccounts, orgMayUseXero, pushInvoice, suggestNumberingFromXero, XERO_PLAN_MESSAGE } from "@/lib/xero";
import type { ActionResult } from "./actions";

async function adminViewer() {
  const viewer = await getViewer();
  return viewer.profile.role === "admin" ? viewer : null;
}

export async function syncInvoiceToXero(invoiceId: string): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  if (!(await getConnection(viewer.orgId))) return { ok: false, error: "Xero isn't connected. Connect it in Settings." };
  if (!(await orgMayUseXero(viewer.orgId))) return { ok: false, error: XERO_PLAN_MESSAGE };
  const result = await pushInvoice(viewer.orgId, invoiceId);
  revalidatePath("/", "layout");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Couldn't send the invoice to Xero." };
}

export async function saveXeroSettings(input: { salesAccountCode?: string; autoSync?: boolean; bankAccountId?: string | null }): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  const patch: { sales_account_code?: string; auto_sync?: boolean; bank_account_id?: string | null; bank_account_name?: string | null } = {};
  if (input.bankAccountId !== undefined) {
    if (input.bankAccountId === null) {
      patch.bank_account_id = null;
      patch.bank_account_name = null;
    } else {
      let accounts: { id: string; name: string }[] = [];
      try {
        accounts = await listBankAccounts(viewer.orgId);
      } catch {
        return { ok: false, error: "Couldn't load your bank accounts from Xero. Try again in a minute." };
      }
      const chosen = accounts.find((a) => a.id === input.bankAccountId);
      if (!chosen) return { ok: false, error: "Choose one of your Xero bank accounts." };
      patch.bank_account_id = chosen.id;
      patch.bank_account_name = chosen.name;
    }
  }
  if (input.salesAccountCode !== undefined) {
    const code = input.salesAccountCode.trim();
    if (!code || code.length > 20) return { ok: false, error: "Choose a sales account." };
    patch.sales_account_code = code;
  }
  if (input.autoSync !== undefined) patch.auto_sync = input.autoSync;
  const { error } = await createAdminClient().from("xero_connections").update(patch).eq("org_id", viewer.orgId);
  if (error) return { ok: false, error: "Couldn't save that. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectXeroAction(): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  await disconnectXero(viewer.orgId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Match my Xero numbering": the latest sales invoice number in Xero, split into prefix, next number and digits. */
export async function readXeroNumbering(): Promise<ActionResult & { prefix?: string; next?: number; digits?: number; sample?: string }> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  if (!(await orgMayUseXero(viewer.orgId))) return { ok: false, error: XERO_PLAN_MESSAGE };
  if (!(await getConnection(viewer.orgId))) return { ok: false, error: "Xero isn't connected. Connect it in Settings." };
  try {
    const found = await suggestNumberingFromXero(viewer.orgId);
    if (!found) return { ok: false, error: "No sales invoices with a numeric ending were found in Xero." };
    return { ok: true, ...found };
  } catch {
    return { ok: false, error: "Couldn't read your invoices from Xero. Try again in a minute." };
  }
}
