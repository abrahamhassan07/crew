import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lands here after Google OAuth. handle_new_user() deliberately leaves
 * profiles empty for an identity with no org_id metadata (see 0008), so an
 * existing staff/admin account (linked by verified email) already has a
 * profile by the time we get here — a brand-new Google identity doesn't.
 * businessName is only present when the button was clicked from /signup;
 * without it, a not-yet-provisioned account has nowhere to go.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const businessName = searchParams.get("businessName")?.trim();

  if (!code) redirect("/login?error=oauth-failed");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) redirect("/login?error=oauth-failed");

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!existingProfile) {
    if (!businessName) {
      await admin.auth.admin.deleteUser(data.user.id);
      redirect("/login?error=no-account");
    }

    const { data: org, error: orgError } = await admin.from("organizations").insert({ name: businessName }).select("id").single();
    if (orgError || !org) {
      await admin.auth.admin.deleteUser(data.user.id);
      redirect("/signup?error=could-not-create-business");
    }

    const { error: profileError } = await admin.from("profiles").insert({ user_id: data.user.id, role: "admin", org_id: org.id });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      redirect("/signup?error=could-not-create-business");
    }
  }

  redirect(next);
}
