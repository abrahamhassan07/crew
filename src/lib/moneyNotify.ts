import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcTotals } from "@/lib/gst";
import { pushToAdmins } from "@/lib/push";

/**
 * Phone pushes to a business's owners and admins about money: a quote marked approved and an invoice paid in full.
 * The person who made the change isn't told about their own action. Never throws.
 */

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function docSummary(table: "quotes" | "invoices", id: string, orgId: string) {
  const admin = createAdminClient();
  const { data: doc } = await admin.from(table).select("num, client_id, mode").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!doc) return null;
  const items$ = table === "quotes" ? admin.from("quote_items").select("qty, unit_price").eq("quote_id", id) : admin.from("invoice_items").select("qty, unit_price").eq("invoice_id", id);
  const [{ data: items }, { data: client }] = await Promise.all([
    items$,
    admin.from("clients").select("name").eq("id", doc.client_id).eq("org_id", orgId).maybeSingle(),
  ]);
  return { num: doc.num, client: client?.name ?? "a client", total: calcTotals(items ?? [], doc.mode).total };
}

export async function notifyQuoteApproved(orgId: string, quoteId: string, actorUserId: string | null): Promise<void> {
  try {
    const d = await docSummary("quotes", quoteId, orgId);
    if (!d) return;
    await pushToAdmins(orgId, { title: "Quote approved", body: `${d.num} for ${d.client}: ${money(d.total)}`, target: { kind: "web", path: `/quotes/${quoteId}` } }, actorUserId);
  } catch (e) {
    console.error("[push] quote approved failed", e);
  }
}

export async function notifyInvoicePaid(orgId: string, invoiceId: string, actorUserId: string | null): Promise<void> {
  try {
    const d = await docSummary("invoices", invoiceId, orgId);
    if (!d) return;
    await pushToAdmins(orgId, { title: "Invoice paid", body: `${d.num} from ${d.client}: ${money(d.total)}`, target: { kind: "web", path: `/invoices/${invoiceId}` } }, actorUserId);
  } catch (e) {
    console.error("[push] invoice paid failed", e);
  }
}
