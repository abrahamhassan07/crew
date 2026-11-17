/**
 * Rules for deleting your own account, kept free of the database so they can be unit-tested.
 *
 * - "staff": a staff member's own login goes; their staff record stays (job history) and is marked inactive.
 * - "admin": an owner/admin while other admins remain: the same, the business carries on.
 * - "business": the only owner/admin: the whole business goes with them (Apple requires a way to delete the account
 *   in the app; a business with no admin left would be stranded).
 */

export type DeletionKind = "staff" | "admin" | "business";

export function deletionKind(role: "admin" | "staff", otherAdmins: number): DeletionKind {
  if (role !== "admin") return "staff";
  return otherAdmins > 0 ? "admin" : "business";
}

/** Typing the business name to confirm: same words, ignoring case, extra spaces and curly quotes. */
export function businessNameMatches(typed: string, actual: string): boolean {
  const norm = (s: string) => s.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
  const a = norm(actual);
  return a.length > 0 && norm(typed) === a;
}

/** How recent a sign-in must be to delete without a password (Apple or Google accounts have none). */
export const RECENT_SIGN_IN_SECONDS = 15 * 60;

/**
 * Whether this login proved who it is recently: the newest sign-in method time in the token's verified `amr`
 * claim (password, Apple, Google, magic link, two-factor code...) within the window.
 */
export function signedInRecently(amr: unknown, nowSeconds: number, windowSeconds = RECENT_SIGN_IN_SECONDS): boolean {
  if (!Array.isArray(amr)) return false;
  const times = amr.map((e) => (e && typeof e === "object" && typeof (e as { timestamp?: unknown }).timestamp === "number" ? (e as { timestamp: number }).timestamp : 0));
  const newest = Math.max(0, ...times);
  return newest > 0 && newest <= nowSeconds + 60 && nowSeconds - newest <= windowSeconds;
}

/** Stripe subscription states that can still charge (or come back) and so must be cancelled first. */
export const subscriptionNeedsCancelling = (status: string | null | undefined, subscriptionId: string | null | undefined) =>
  !!subscriptionId && !["canceled", "incomplete_expired"].includes(status ?? "");
