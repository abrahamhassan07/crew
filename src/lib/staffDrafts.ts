import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer, type Viewer } from "@/lib/auth";
import { aiAllowed } from "@/lib/billing";
import type { Client, Organization } from "@/lib/supabase/types";

// Staff drafts. Staff have no direct access to the quotes, invoices, clients or price list tables (row-level security
// keeps those to owners and admins). Everything here runs on the server with the service role AFTER checking, in
// code, who is asking, that their business has switched staff drafts on, and which clients they may use.

export type StaffContext = { ok: true; viewer: Viewer; org: Organization; staffId: string } | { ok: false; error: string };

/** The signed-in staff member, if staff drafts are on for their business and their plan includes them. */
export async function staffDraftContext(): Promise<StaffContext> {
  const viewer = await getViewer();
  if (viewer.profile.role !== "staff" || !viewer.staff) return { ok: false, error: "This is for staff accounts." };
  const { data: org } = await createAdminClient().from("organizations").select("*").eq("id", viewer.orgId).single();
  if (!org) return { ok: false, error: "Business not found." };
  if (!aiAllowed(org) || !org.staff_drafts_enabled) return { ok: false, error: "Staff drafts aren't switched on for your business. Ask the owner." };
  return { ok: true, viewer, org, staffId: viewer.staff.id };
}

/** Clients on jobs assigned to this staff member (and nobody else's). */
export async function assignedClientIds(orgId: string, staffId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("jobs").select("client_id").eq("org_id", orgId).eq("assigned_staff_id", staffId).not("client_id", "is", null);
  return [...new Set((data ?? []).map((j) => j.client_id as string))];
}

/** A client with only what a quote or invoice needs. Care details, tags, hours and accounting IDs stay with the owner. */
const redact = (c: Client): Client => ({ ...c, care_provider: null, case_manager: null, hours_allocated: null, tags: [], lead_source: null, review_requested_at: null, xero_contact_id: null, company: c.company });

/** What a staff member needs to prepare a draft: their clients (name only plus address), those clients' properties, the price list. */
export async function staffDraftData(orgId: string, staffId: string) {
  const admin = createAdminClient();
  const ids = await assignedClientIds(orgId, staffId);
  const [{ data: clients }, { data: properties }, { data: services }, { data: jobs }] = await Promise.all([
    ids.length ? admin.from("clients").select("*").eq("org_id", orgId).in("id", ids).order("name") : Promise.resolve({ data: [] }),
    ids.length ? admin.from("properties").select("*").eq("org_id", orgId).in("client_id", ids) : Promise.resolve({ data: [] }),
    admin.from("services").select("*").eq("org_id", orgId).eq("active", true).order("name"),
    admin.from("jobs").select("id, num, title, job_type, client_id, job_date").eq("org_id", orgId).eq("assigned_staff_id", staffId),
  ]);
  return { clients: (clients ?? []).map(redact), properties: properties ?? [], services: services ?? [], jobs: jobs ?? [] };
}

/** The business details a quote or invoice shows, without billing or account fields. */
export const publicOrg = (o: Organization): Organization => ({ ...o, stripe_customer_id: null, stripe_subscription_id: null, subscription_status: null, current_period_end: null, plan: null, team_size: null, billing_interval: null });

/** Looks up a name for the audit trail: who prepared and who approved a document. */
export async function nameForUser(orgId: string, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("staff_id").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  if (p?.staff_id) {
    const { data: s } = await admin.from("staff").select("name").eq("id", p.staff_id).maybeSingle();
    if (s?.name) return s.name;
  }
  const { data } = await admin.auth.admin.getUserById(userId);
  return (data.user?.user_metadata?.name as string | undefined) || data.user?.email || null;
}
