import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Profile, Staff } from "@/lib/supabase/types";

/**
 * Sign-ins for the phone app's native screens (the web view inside the app uses the normal site cookies).
 *
 * How it works:
 * - The app asks the site for its own sign-in while the person is signed in on the site (two-factor already passed).
 *   The site makes a NEW, separate Supabase session for them (sharing the web view's session would break, because
 *   refresh tokens rotate) and records it in app_sessions.
 * - Every /api/app/* call sends that session's access token. It is checked with Supabase AND must be listed in
 *   app_sessions and not revoked, so a password-only login from anywhere else can't use these endpoints.
 * - Database reads use the person's own token, so the normal row rules apply (staff only see their own jobs).
 */

type Db = SupabaseClient<Database>;

/** Sessions not used for this long stop working, the same as the site's idle sign-out. */
const IDLE_MS = (Number(process.env.SESSION_IDLE_HOURS) || 168) * 60 * 60 * 1000;

export interface AppViewer {
  userId: string;
  orgId: string;
  sessionId: string;
  profile: Profile;
  staff: Staff | null;
  isAdmin: boolean;
}

export interface AppTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const anonClient = (accessToken?: string): Db =>
  createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });

/** Read the claims of a token that Supabase has already confirmed (never trust this on an unchecked token). */
function claims(token: string): { session_id?: string; sub?: string } {
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return {};
  }
}

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Make a fresh app sign-in for someone already signed in on the site. */
export async function mintAppSession(user: { id: string; email: string }, orgId: string, device: string): Promise<AppTokens | null> {
  const admin = createAdminClient();
  // A one-time sign-in link made on the server and used straight away; nothing is emailed.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed || link.user?.id !== user.id) return null;
  const { data, error } = await anonClient().auth.verifyOtp({ type: "email", token_hash: hashed });
  const session = data?.session;
  if (error || !session || session.user.id !== user.id) return null;
  const sessionId = claims(session.access_token).session_id;
  if (!isUuid(sessionId)) return null;
  const { error: insertError } = await admin.from("app_sessions").insert({ user_id: user.id, org_id: orgId, session_id: sessionId, device: device.slice(0, 120) });
  if (insertError) {
    await admin.auth.admin.signOut(session.access_token, "local").catch(() => {});
    return null;
  }
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600 };
}

/** Is this Supabase session a live app sign-in? Updates last-seen (at most every few minutes). */
async function checkAppSession(sessionId: string, userId: string): Promise<{ orgId: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_sessions").select("id, org_id, user_id, last_seen_at, revoked_at").eq("session_id", sessionId).maybeSingle();
  if (!data || data.revoked_at || data.user_id !== userId) return null;
  const seen = new Date(data.last_seen_at).getTime();
  if (Date.now() - seen > IDLE_MS) {
    await admin.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    return null;
  }
  if (Date.now() - seen > 5 * 60 * 1000) await admin.from("app_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return { orgId: data.org_id };
}

/** Check the bearer token on an /api/app/* request. Returns the person and a database client that acts as them. */
export async function getAppViewer(req: Request): Promise<{ viewer: AppViewer; db: Db } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const db = anonClient(token);
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return null;
  const sessionId = claims(token).session_id;
  if (!isUuid(sessionId)) return null;
  const live = await checkAppSession(sessionId, auth.user.id);
  if (!live) return null;
  const { data: row } = await db.from("profiles").select("*, staff(*)").eq("user_id", auth.user.id).single<Profile & { staff: Staff | null }>();
  if (!row || row.org_id !== live.orgId) return null;
  const { staff, ...profile } = row;
  return { viewer: { userId: auth.user.id, orgId: profile.org_id, sessionId, profile, staff: staff ?? null, isAdmin: profile.role === "admin" }, db };
}

/** Swap a refresh token for new tokens, only for live app sign-ins. */
export async function refreshAppSession(refreshToken: string): Promise<AppTokens | null> {
  if (!refreshToken || refreshToken.length > 4096) return null;
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
  const session = data?.session;
  if (error || !session) return null;
  const sessionId = claims(session.access_token).session_id;
  if (!isUuid(sessionId) || !(await checkAppSession(sessionId, session.user.id))) {
    await createAdminClient().auth.admin.signOut(session.access_token, "local").catch(() => {});
    return null;
  }
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600 };
}

/** End an app sign-in (signing out in the app, or signing out of the site inside the app). */
export async function revokeAppSession(viewer: AppViewer, accessToken: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("session_id", viewer.sessionId);
  await admin.auth.admin.signOut(accessToken, "local").catch(() => {});
}
