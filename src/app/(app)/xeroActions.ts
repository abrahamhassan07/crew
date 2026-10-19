"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectXero, getConnection, pushInvoice } from "@/lib/xero";
import type { ActionResult } from "./actions";

async function adminViewer() {
  const viewer = await getViewer();
  return viewer.profile.role === "admin" ? viewer : null;
}

export async function syncInvoiceToXero(invoiceId: string): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  if (!(await getConnection(viewer.orgId))) return { ok: false, error: "Xero isn't connected. Connect it in Settings." };
  const result = await pushInvoice(viewer.orgId, invoiceId);
  revalidatePath("/", "layout");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Couldn't send the invoice to Xero." };
}

export async function saveXeroSettings(input: { salesAccountCode?: string; autoSync?: boolean }): Promise<ActionResult> {
  const viewer = await adminViewer();
  if (!viewer) return { ok: false, error: "Only admins can do that." };
  const patch: { sales_account_code?: string; auto_sync?: boolean } = {};
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
