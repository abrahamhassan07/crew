import "server-only";
import { NextResponse } from "next/server";
import { getAppViewer } from "@/lib/appAuth";

/** Shared bits for /api/app/* route handlers. Responses are never cached. */
export const noStore = { "Cache-Control": "no-store" };

export const appJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });
export const appError = (error: string, status: number) => appJson({ error }, status);

/** Run a handler only for a signed-in app user; anything else gets 401 so the app knows to sign in again. */
export async function withAppViewer(req: Request, run: (ctx: NonNullable<Awaited<ReturnType<typeof getAppViewer>>>) => Promise<Response>): Promise<Response> {
  const ctx = await getAppViewer(req);
  if (!ctx) return appError("Please sign in again.", 401);
  return run(ctx);
}

export const isIsoDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
