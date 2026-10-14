import { requireAdmin } from "@/lib/auth";

// Temporary: throws on purpose so we can confirm errors reach Sentry. Remove after verifying.
export async function GET() {
  await requireAdmin();
  throw new Error("Sentry test error from Crew & Grounds (deliberate)");
}
