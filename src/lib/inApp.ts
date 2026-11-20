import "server-only";
import { cookies, headers } from "next/headers";
import { APP_COOKIE } from "@/lib/appFlag";
import { stripUpsell } from "@/lib/upsell";

/** The phone app adds this to its user agent (see crew-mobile). */
export const APP_UA_TOKEN = "CrewAndGroundsApp";

/**
 * True when the request comes from inside the Crew & Grounds phone app: its user agent, or the cookie the site sets
 * there (the user agent doesn't reach form posts and server actions).
 */
export async function isAppRequest(): Promise<boolean> {
  if (((await headers()).get("user-agent") ?? "").includes(APP_UA_TOKEN)) return true;
  return (await cookies()).get(APP_COOKIE)?.value === "1";
}

/**
 * For the sign-in and sign-up forms: the app's user agent doesn't always reach form posts, so the form also says
 * it's inside the app (TurnstileWidget adds `in_app`). Either is enough. Both can be faked, which is fine: it only
 * swaps Cloudflare's check for the attempt limits.
 */
export async function isAppForm(formData: FormData): Promise<boolean> {
  return formData.get("in_app") === "1" || (await isAppRequest());
}

/** A message as it should read where it's shown: plan and upgrade prompts are dropped inside the phone app (store rules). */
export async function appSafe(message: string): Promise<string> {
  try {
    return (await isAppRequest()) ? stripUpsell(message) : message;
  } catch {
    // Outside a request (scheduled jobs) there's no app to worry about.
    return message;
  }
}
