/** Search rules kept free of the database so they can be unit-tested. */

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 60;

/**
 * A safe "contains" pattern for a PostgREST `ilike` inside `.or(...)`: LIKE wildcards in what was typed are matched
 * literally, and the value is double-quoted so commas, brackets and dots can't change the filter. Null when there's
 * too little to search for.
 */
export function buildSearchPattern(raw: string): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
  if (q.length < MIN_SEARCH_LENGTH) return null;
  const literal = q.replace(/[\\%_]/g, (m) => `\\${m}`);
  const quoted = `%${literal}%`.replace(/["\\]/g, (m) => `\\${m}`);
  return `"${quoted}"`;
}

/** "1 May" this year, "1 May 2027" otherwise, from a stored YYYY-MM-DD. */
export function friendlyDate(iso: string | null | undefined, thisYear = new Date().getFullYear()): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC", ...(y !== thisYear ? { year: "numeric" } : {}) });
}

/** Job results: upcoming ones (today on) soonest first, then past ones most recent first. Unscheduled last. */
export function orderJobs<T extends { job_date: string | null }>(jobs: T[], today: string): T[] {
  const upcoming = jobs.filter((j) => j.job_date && j.job_date >= today).sort((a, b) => a.job_date!.localeCompare(b.job_date!));
  const past = jobs.filter((j) => j.job_date && j.job_date < today).sort((a, b) => b.job_date!.localeCompare(a.job_date!));
  return [...upcoming, ...past, ...jobs.filter((j) => !j.job_date)];
}
