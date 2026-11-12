/** Job checklist input checks (shared by the site and the phone app). No server-only imports so it can be unit-tested. */
export const MAX_CHECKLIST_ITEMS = 100;
export const MAX_CHECKLIST_TEXT = 300;

/** Keep only well-formed checklist items; anything malformed rejects the whole list (null). */
export function cleanChecklist(raw: unknown): { t: string; done: boolean }[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_CHECKLIST_ITEMS) return null;
  const out: { t: string; done: boolean }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { t, done } = item as { t?: unknown; done?: unknown };
    if (typeof t !== "string" || typeof done !== "boolean") return null;
    out.push({ t: t.slice(0, MAX_CHECKLIST_TEXT), done });
  }
  return out;
}
