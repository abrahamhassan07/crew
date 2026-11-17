import { createAdminClient } from "@/lib/supabase/admin";
import { isExpoToken } from "@/lib/pushCore";
import { appError, appJson, withAppViewer } from "@/lib/appApi";

export const dynamic = "force-dynamic";

/**
 * POST { token, platform }: this phone allowed notifications. The token is tied to the app sign-in making the call,
 * so it stops getting pushes when that sign-in ends. A phone has one token, so a different person signing in on the
 * same phone takes it over.
 */
export async function POST(req: Request) {
  return withAppViewer(req, async ({ viewer }) => {
    const body = (await req.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null;
    if (!body || !isExpoToken(body.token)) return appError("That notification token isn't valid.", 400);
    if (body.platform !== "ios" && body.platform !== "android") return appError("Unknown phone type.", 400);
    const admin = createAdminClient();
    const { data: session } = await admin.from("app_sessions").select("id").eq("session_id", viewer.sessionId).single();
    if (!session) return appError("Please sign in again.", 401);
    const { error } = await admin.from("push_tokens").upsert(
      { token: body.token, user_id: viewer.userId, org_id: viewer.orgId, app_session_id: session.id, platform: body.platform, updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );
    if (error) {
      console.error("[push] save token failed", error.message);
      return appError("Couldn't turn on notifications. Please try again.", 500);
    }
    return appJson({ ok: true });
  });
}

/** DELETE { token }: stop pushes to this phone (only its own token, for the person signed in). */
export async function DELETE(req: Request) {
  return withAppViewer(req, async ({ viewer }) => {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    if (!body || !isExpoToken(body.token)) return appError("That notification token isn't valid.", 400);
    await createAdminClient().from("push_tokens").delete().eq("token", body.token).eq("user_id", viewer.userId);
    return appJson({ ok: true });
  });
}
