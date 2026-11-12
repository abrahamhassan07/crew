import "server-only";
import { headers } from "next/headers";

/** The phone app adds this to its user agent (see crew-mobile). */
export const APP_UA_TOKEN = "CrewAndGroundsApp";

/** True when the page is being loaded inside the Crew & Grounds phone app. */
export async function isAppRequest(): Promise<boolean> {
  return ((await headers()).get("user-agent") ?? "").includes(APP_UA_TOKEN);
}
