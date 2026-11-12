import { refreshAppSession } from "@/lib/appAuth";
import { appError, appJson } from "@/lib/appApi";

export const dynamic = "force-dynamic";

/** Swap the app's refresh token for fresh tokens (only for live app sign-ins). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { refresh_token?: unknown } | null;
  const refresh = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  const tokens = await refreshAppSession(refresh);
  if (!tokens) return appError("Please sign in again.", 401);
  return appJson(tokens);
}
