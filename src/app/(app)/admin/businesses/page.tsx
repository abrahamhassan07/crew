import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform";
import { getBillingState } from "@/lib/billing";
import { AdminBusinessesClient, type AdminBusiness } from "@/components/AdminBusinessesClient";

export default async function AdminBusinessesPage() {
  const viewer = await getViewer();
  if (!isPlatformAdmin(viewer.email)) notFound();

  const db = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [{ data: orgs }, { data: profiles }, { data: staff }, { data: logs }, authList] = await Promise.all([
    db.from("organizations").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("user_id, role, org_id, staff_id"),
    db.from("staff").select("id, name, active"),
    db.from("email_log").select("org_id, kind").gte("created_at", monthStart),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const authById = new Map((authList.data?.users ?? []).map((u) => [u.id, u]));
  const staffById = new Map((staff ?? []).map((s) => [s.id, s]));

  const counts = await Promise.all(
    (orgs ?? []).map(async (o) => {
      const [clients, jobs] = await Promise.all([
        db.from("clients").select("id", { count: "exact", head: true }).eq("org_id", o.id),
        db.from("jobs").select("id", { count: "exact", head: true }).eq("org_id", o.id),
      ]);
      return [o.id, { clients: clients.count ?? 0, jobs: jobs.count ?? 0 }] as const;
    })
  );
  const countsByOrg = new Map(counts);

  // listUsers doesn't return factors, so ask per user which have two-factor on.
  const withTwoFactor = new Set(
    (
      await Promise.all(
        (profiles ?? []).map(async (p) => {
          const { data } = await db.auth.admin.mfa.listFactors({ userId: p.user_id });
          return (data?.factors ?? []).some((f) => f.status === "verified") ? p.user_id : null;
        })
      )
    ).filter((id): id is string => !!id)
  );

  const businesses: AdminBusiness[] = (orgs ?? []).map((o) => {
    const state = getBillingState(o);
    const billing =
      state.kind === "exempt" ? "Exempt" : state.kind === "active" ? `Subscribed${o.team_size ? ` (${o.team_size})` : ""}` : state.kind === "trial" ? `Trial, ${state.daysLeft}d left` : "Trial ended";
    const orgLogs = (logs ?? []).filter((l) => l.org_id === o.id);
    return {
      id: o.id,
      name: o.name,
      email: o.email,
      createdAt: o.created_at,
      billing,
      billingKind: state.kind,
      reminders: o.reminders_enabled,
      staffNotifications: o.staff_notifications_enabled,
      clients: countsByOrg.get(o.id)?.clients ?? 0,
      jobs: countsByOrg.get(o.id)?.jobs ?? 0,
      documentsEmailed: orgLogs.filter((l) => l.kind === "quote" || l.kind === "invoice").length,
      notificationsEmailed: orgLogs.filter((l) => l.kind === "reminder" || l.kind === "staff").length,
      users: (profiles ?? [])
        .filter((p) => p.org_id === o.id)
        .map((p) => {
          const u = authById.get(p.user_id);
          return {
            userId: p.user_id,
            email: u?.email ?? "(unknown)",
            name: (p.staff_id && staffById.get(p.staff_id)?.name) || "",
            role: p.role,
            twoFactor: withTwoFactor.has(p.user_id),
            lastSignIn: u?.last_sign_in_at ?? null,
          };
        }),
    };
  });

  return <AdminBusinessesClient businesses={businesses} />;
}
