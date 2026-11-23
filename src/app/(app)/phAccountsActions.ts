"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectPhAccounts, getConnection, listPhChoices, orgMayUsePhAccounts, PH_PLAN_MESSAGE, pushInvoiceToPh } from "@/lib/phAccounts";
import type { ActionResult } from "./actions";
import type { PhAccountsConnection } from "@/lib/supabase/types";
import { appSafe } from "@/lib/inApp";

async function adminViewer() {
  const viewer = await getViewer();
  return viewer.profile.role === "admin" ? viewer : null;
}

type Choice = "revenue" | "taxCode" | "bank";

/**
 * Saves one Settings › PH Accounts choice. Ids are checked against the business's own lists from PH Accounts
 * (never trusted from the browser) and the display name is stored with them.
 */
export async function savePhAccountsSettings(input: { choice?: Choice; id?: string | null; autoSync?: boolean }): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  if (!(await orgMayUsePhAccounts(viewer.orgId))) return { ok: false, error: await appSafe(PH_PLAN_MESSAGE) };
  const conn = await getConnection(viewer.orgId);
  if (!conn) return { ok: false, error: "PH Accounts isn't connected. Connect it in Settings." };

  const patch: Partial<PhAccountsConnection> = {};
  if (input.autoSync !== undefined) patch.auto_sync = input.autoSync;
  if (input.choice) {
    const set = (id: string | null, name: string | null) => {
      if (input.choice === "revenue") Object.assign(patch, { revenue_account_id: id, revenue_account_name: name });
      else if (input.choice === "taxCode") Object.assign(patch, { gst_tax_code_id: id, gst_tax_code_name: name });
      else Object.assign(patch, { bank_account_id: id, bank_account_name: name });
    };
    if (!["revenue", "taxCode", "bank"].includes(input.choice)) return { ok: false, error: "Unknown setting." };
    if (input.id === null || input.id === "" || input.id === undefined) {
      if (input.choice === "revenue") return { ok: false, error: "Choose a sales account." };
      set(null, null);
    } else {
      let lists;
      try {
        lists = await listPhChoices(conn);
      } catch {
        return { ok: false, error: "Couldn't load your lists from PH Accounts. Try again in a minute." };
      }
      const list = { revenue: lists.revenue, taxCode: lists.taxCodes, bank: lists.banks }[input.choice];
      const chosen = list.find((c) => c.id === input.id);
      if (!chosen) return { ok: false, error: "Choose one of the options from PH Accounts." };
      set(chosen.id, chosen.name);
    }
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await createAdminClient().from("ph_accounts_connections").update(patch).eq("org_id", viewer.orgId);
  if (error) return { ok: false, error: "Couldn't save that. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectPhAccountsAction(): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  await disconnectPhAccounts(viewer.orgId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The "Send to PH Accounts" / "Resync to PH Accounts" button on an invoice. */
export async function syncInvoiceToPhAccounts(invoiceId: string): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  if (!(await getConnection(viewer.orgId))) return { ok: false, error: "PH Accounts isn't connected. Connect it in Settings." };
  if (!(await orgMayUsePhAccounts(viewer.orgId))) return { ok: false, error: await appSafe(PH_PLAN_MESSAGE) };
  const result = await pushInvoiceToPh(viewer.orgId, invoiceId);
  revalidatePath("/", "layout");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Couldn't send the invoice to PH Accounts." };
}
