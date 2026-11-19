import "server-only";
import { headers } from "next/headers";
import { stripUpsell } from "@/lib/upsell";

/** The phone app adds this to its user agent (see crew-mobile). */
export const APP_UA_TOKEN = "CrewAndGroundsApp";

/** True when the page is being loaded inside the Crew & Grounds phone app. */
export async function isAppRequest(): Promise<boolean> {
  return ((await headers()).get("user-agent") ?? "").includes(APP_UA_TOKEN);
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
