import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { disconnectXero } from "@/lib/xero";
import { BUCKET as PHOTO_BUCKET } from "@/lib/photos";
import { LOGO_BUCKET } from "@/lib/logo";
import { businessNameMatches, deletionKind, signedInRecently, subscriptionNeedsCancelling, type DeletionKind } from "@/lib/accountDeletionCore";
import type { Viewer } from "@/lib/auth";

/**
 * Deleting your own account from inside the product (Apple guideline 5.1.1(v)). See accountDeletionCore.ts for who
 * deletes what. Order for a whole business: cancel the Stripe subscription first (if that fails nothing is deleted,
 * so nobody is charged for a business that's gone), disconnect Xero, remove stored files, delete the business (every
 * table cascades), then delete every login that belonged to it. Never touches another business.
 */

export interface DeletionPlan {
  kind: DeletionKind;
  businessName: string;
  otherAdmins: number;
  staffLogins: number;
  subscriptionActive: boolean;
  xeroConnected: boolean;
  hasPassword: boolean;
}

export async function deletionPlan(viewer: Viewer): Promise<DeletionPlan> {
  const admin = createAdminClient();
  const [{ data: org }, { data: profiles }, { data: xero }, { data: auth }] = await Promise.all([
    admin.from("organizations").select("name, stripe_subscription_id, subscription_status").eq("id", viewer.orgId).single(),
    admin.from("profiles").select("user_id, role").eq("org_id", viewer.orgId),
    admin.from("xero_connections").select("org_id").eq("org_id", viewer.orgId).maybeSingle(),
    admin.auth.admin.getUserById(viewer.userId),
  ]);
  const others = (profiles ?? []).filter((p) => p.user_id !== viewer.userId);
  const otherAdmins = others.filter((p) => p.role === "admin").length;
  return {
    kind: deletionKind(viewer.profile.role === "admin" ? "admin" : "staff", otherAdmins),
    businessName: org?.name ?? "",
    otherAdmins,
    staffLogins: others.length,
    subscriptionActive: subscriptionNeedsCancelling(org?.subscription_status, org?.stripe_subscription_id),
    xeroConnected: !!xero,
    hasPassword: (auth?.user?.identities ?? []).some((i) => i.provider === "email"),
  };
}

/** Proves it's really them: their password, or (no password, e.g. Apple or Google) a sign-in in the last 15 minutes. */
async function confirmIdentity(viewer: Viewer, password: string | undefined, hasPassword: boolean): Promise<string | null> {
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return "Please finish two-factor sign-in first.";

  if (password) {
    if (!hasPassword) return "This account doesn't use a password. Sign out, sign back in, then delete within 15 minutes.";
    // A throwaway client so checking the password doesn't touch this browser's sign-in; its new session is ended at once.
    const check = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data, error } = await check.auth.signInWithPassword({ email: viewer.email, password });
    if (error || data.user?.id !== viewer.userId) return "That password isn't right.";
    if (data.session) await createAdminClient().auth.admin.signOut(data.session.access_token, "local").catch(() => {});
    return null;
  }

  const { data: claims } = await supabase.auth.getClaims();
  if (signedInRecently(claims?.claims?.amr, Math.floor(Date.now() / 1000))) return null;
  return hasPassword ? "Enter your password to confirm." : "For your safety, sign out and sign back in, then delete within 15 minutes.";
}

async function removeFolder(bucket: string, prefix: string): Promise<void> {
  const admin = createAdminClient();
  const files: string[] = [];
  const walk = async (path: string, depth: number) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from(bucket).list(path, { limit: 1000, offset });
      if (error || !data) return;
      for (const e of data) {
        const full = `${path}/${e.name}`;
        if (e.id == null) {
          if (depth < 3) await walk(full, depth + 1);
        } else files.push(full);
      }
      if (data.length < 1000) return;
    }
  };
  await walk(prefix, 0);
  for (let i = 0; i < files.length; i += 100) await admin.storage.from(bucket).remove(files.slice(i, i + 100));
}

export type DeleteResult = { ok: true; kind: DeletionKind } | { ok: false; error: string };

export async function deleteOwnAccount(viewer: Viewer, input: { password?: string; confirmName?: string }): Promise<DeleteResult> {
  const plan = await deletionPlan(viewer);
  const identityError = await confirmIdentity(viewer, input.password?.slice(0, 200) || undefined, plan.hasPassword);
  if (identityError) return { ok: false, error: identityError };

  const admin = createAdminClient();

  if (plan.kind !== "business") {
    // Keep the staff record for job history, but it can't be assigned new work or sign in again.
    if (viewer.staff) await admin.from("staff").update({ active: false, user_id: null }).eq("id", viewer.staff.id).eq("org_id", viewer.orgId);
    const { error } = await admin.auth.admin.deleteUser(viewer.userId);
    if (error) return { ok: false, error: "Couldn't delete your account. Please try again or contact support." };
    console.info("[account] deleted own login", { userId: viewer.userId, orgId: viewer.orgId, kind: plan.kind });
    return { ok: true, kind: plan.kind };
  }

  if (!businessNameMatches(input.confirmName ?? "", plan.businessName)) return { ok: false, error: "Type your business name exactly as shown to confirm." };

  const { data: org } = await admin.from("organizations").select("id, stripe_subscription_id, subscription_status").eq("id", viewer.orgId).single();
  if (!org) return { ok: false, error: "Business not found." };

  // 1. Stop all charges first. If this fails, stop here with nothing deleted.
  if (subscriptionNeedsCancelling(org.subscription_status, org.stripe_subscription_id)) {
    try {
      await getStripe().subscriptions.cancel(org.stripe_subscription_id!);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "resource_missing") {
        console.error("[account] subscription cancel failed", org.id, e instanceof Error ? e.message : e);
        return { ok: false, error: "Couldn't cancel your subscription, so nothing was deleted. Please try again or contact support." };
      }
    }
  }

  // 2. Disconnect Xero (best effort: the connection row goes with the business anyway).
  if (plan.xeroConnected) await disconnectXero(org.id).catch(() => {});

  // 3. Stored files (the daily cleanup also sweeps photo folders of deleted businesses if anything is missed).
  await removeFolder(PHOTO_BUCKET, org.id).catch(() => {});
  await removeFolder(LOGO_BUCKET, org.id).catch(() => {});

  // 4. Everyone who signs in to this business, then the business itself (all its data cascades).
  const { data: members } = await admin.from("profiles").select("user_id").eq("org_id", org.id);
  const userIds = [...new Set([...(members ?? []).map((m) => m.user_id), viewer.userId])];
  const { error: orgError } = await admin.from("organizations").delete().eq("id", org.id);
  if (orgError) {
    console.error("[account] business delete failed", org.id, orgError.message);
    return { ok: false, error: "Couldn't delete the business data. Your subscription was cancelled; please contact support to finish." };
  }
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error("[account] login delete failed", id, error.message);
  }
  console.info("[account] deleted business", { orgId: org.id, logins: userIds.length });
  return { ok: true, kind: "business" };
}
