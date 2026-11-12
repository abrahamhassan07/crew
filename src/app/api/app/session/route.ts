import { createClient } from "@/lib/supabase/server";
import { mintAppSession, revokeAppSession } from "@/lib/appAuth";
import { APP_UA_TOKEN } from "@/lib/inApp";
import { appError, appJson, withAppViewer } from "@/lib/appApi";

export const dynamic = "force-dynamic";

/**
 * POST: the app's web view asks for a native sign-in for the person signed in on the site. Only from inside the app
 * (its user agent plus a custom header, which other sites can't send without a blocked cross-site preflight), only
 * with a full site sign-in (two-factor passed where it's on).
 */
export async function POST(req: Request) {
  if (!(req.headers.get("user-agent") ?? "").includes(APP_UA_TOKEN) || req.headers.get("x-crew-app") !== "1") return appError("Not available.", 403);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return appError("Please sign in again.", 401);
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return appError("Please finish signing in.", 401);
  const { data: profile } = await supabase.from("profiles").select("org_id").eq("user_id", user.id).single();
  if (!profile) return appError("Please sign in again.", 401);
  const device = (req.headers.get("user-agent") ?? "").replace(/[^\x20-\x7e]/g, "");
  const tokens = await mintAppSession({ id: user.id, email: user.email }, profile.org_id, device);
  if (!tokens) return appError("Couldn't start the app sign-in. Please try again.", 500);
  return appJson({ ...tokens, user_id: user.id });
}

/** DELETE: sign the app out (the token used for this call stops working). */
export async function DELETE(req: Request) {
  return withAppViewer(req, async ({ viewer }) => {
    const token = (req.headers.get("authorization") ?? "").slice(7).trim();
    await revokeAppSession(viewer, token);
    return appJson({ ok: true });
  });
}
