"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GoogleProvisionResult {
  ok: boolean;
  error?: string;
}

/**
 * Runs right after a client-side Google sign-in (signInWithIdToken) has
 * already established a session. handle_new_user() deliberately leaves
 * profiles empty for an identity with no org_id metadata (see migration
 * 0008), so an existing staff/admin account (linked by verified email)
 * already has a profile by the time we get here — a brand-new Google
 * identity doesn't. businessName is only passed from the signup page;
 * without it, a not-yet-provisioned account has nowhere to go.
 */
export async function provisionAfterGoogleSignIn(businessName?: string): Promise<GoogleProvisionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "oauth-failed" };

  const admin = createAdminClient();
  const { data: existingProfile } = await admin.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();

  if (existingProfile) return { ok: true };

  const trimmed = businessName?.trim();
  if (!trimmed) {
    await admin.auth.admin.deleteUser(user.id);
    return { ok: false, error: "no-account" };
  }

  const { data: org, error: orgError } = await admin.from("organizations").insert({ name: trimmed }).select("id").single();
  if (orgError || !org) {
    await admin.auth.admin.deleteUser(user.id);
    return { ok: false, error: "could-not-create-business" };
  }

  const { error: profileError } = await admin.from("profiles").insert({ user_id: user.id, role: "admin", org_id: org.id });
  if (profileError) {
    await admin.auth.admin.deleteUser(user.id);
    return { ok: false, error: "could-not-create-business" };
  }

  return { ok: true };
}
