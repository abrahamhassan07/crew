import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_IDLE_MS } from "@/lib/appAuth";
import { buildMessages, chunk, deadTokens, type ExpoTicket, type PushNote } from "@/lib/pushCore";

/**
 * Phone pushes to people in one business, through Expo's free push service. Only phones with a live app sign-in get
 * them (see migration 0033). Never throws: a failed push must not fail the change that caused it.
 * EXPO_ACCESS_TOKEN is optional; set it only if "enhanced push security" is turned on in the Expo project.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function pushToUsers(orgId: string, userIds: string[], note: PushNote): Promise<number> {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return 0;
    const admin = createAdminClient();
    const { data: rows } = await admin.from("push_tokens").select("token, app_session_id").eq("org_id", orgId).in("user_id", ids);
    if (!rows?.length) return 0;
    const { data: sessions } = await admin.from("app_sessions").select("id, revoked_at, last_seen_at").eq("org_id", orgId).in("id", [...new Set(rows.map((r) => r.app_session_id))]);
    const cutoff = Date.now() - APP_IDLE_MS;
    const live = new Set((sessions ?? []).filter((s) => !s.revoked_at && new Date(s.last_seen_at).getTime() > cutoff).map((s) => s.id));
    const tokens = rows.filter((r) => live.has(r.app_session_id)).map((r) => r.token);
    const messages = buildMessages(tokens, note);
    let sent = 0;
    for (const batch of chunk(messages)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(8000),
      }).catch((e) => {
        console.error("[push] request failed", e instanceof Error ? e.message : e);
        return null;
      });
      if (!res?.ok) {
        if (res) console.error("[push] Expo said", res.status);
        continue;
      }
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = json?.data ?? [];
      sent += tickets.filter((t) => t?.status === "ok").length;
      const dead = deadTokens(batch, tickets);
      if (dead.length) await admin.from("push_tokens").delete().in("token", dead);
    }
    return sent;
  } catch (e) {
    console.error("[push] failed", e);
    return 0;
  }
}

/** The signed-in users for staff records (through their profile). */
export async function userIdsForStaff(orgId: string, staffIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(staffIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await createAdminClient().from("profiles").select("user_id, staff_id").eq("org_id", orgId).in("staff_id", ids);
  return new Map((data ?? []).filter((p) => p.staff_id).map((p) => [p.staff_id as string, p.user_id]));
}

/** Owners and admins of a business, optionally leaving out the person who made the change. */
export async function adminUserIds(orgId: string, exceptUserId?: string | null): Promise<string[]> {
  const { data } = await createAdminClient().from("profiles").select("user_id").eq("org_id", orgId).eq("role", "admin");
  return (data ?? []).map((p) => p.user_id).filter((id) => id !== exceptUserId);
}

/** Push to a business's owners and admins (never throws). */
export async function pushToAdmins(orgId: string, note: PushNote, exceptUserId?: string | null): Promise<void> {
  try {
    await pushToUsers(orgId, await adminUserIds(orgId, exceptUserId), note);
  } catch (e) {
    console.error("[push] admins failed", e);
  }
}
