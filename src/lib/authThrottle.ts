import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Attempt limits for sign-in and sign-up from the phone app, where Cloudflare Turnstile can't run (it fails inside app
 * web views). Counted in auth_attempts by the server only.
 */
export const LIMITS = {
  // Failed passwords: per email and per network address, in 15 minutes.
  signin_failed: { perEmail: 10, perIp: 30, minutes: 15 },
  // New businesses: per network address, in an hour.
  signup: { perIp: 5, minutes: 60 },
} as const;

type Kind = keyof typeof LIMITS;

export const ipKey = (ip: string | null | undefined) => `ip:${ip || "unknown"}`;
export const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;

async function countSince(kind: Kind, key: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await createAdminClient().from("auth_attempts").select("id", { count: "exact", head: true }).eq("kind", kind).eq("key", key).gte("created_at", since);
  return count ?? 0;
}

/** True when any of the keys has reached its limit. */
export async function overLimit(kind: Kind, keys: { key: string; limit: number }[]): Promise<boolean> {
  const minutes = LIMITS[kind].minutes;
  const counts = await Promise.all(keys.map((k) => countSince(kind, k.key, minutes)));
  return counts.some((n, i) => n >= keys[i].limit);
}

export async function recordAttempt(kind: Kind, keys: string[]): Promise<void> {
  const admin = createAdminClient();
  await admin.from("auth_attempts").insert(keys.map((key) => ({ kind, key })));
  // Old rows are no use to anyone; tidy up now and then.
  if (Math.random() < 0.05) await admin.from("auth_attempts").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
}
