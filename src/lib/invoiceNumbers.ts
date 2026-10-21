// Invoice numbers and references. Shared by the server (saving) and the browser (the invoice form and
// Settings), so this file must stay free of server-only imports.

export const DEFAULT_PREFIX = "INV-";
export const DEFAULT_REFERENCE_TEMPLATE = "Job {job_number}";
export const MAX_NUMBER_LENGTH = 40;
export const MAX_REFERENCE_LENGTH = 255;

export interface NumberingSettings {
  prefix: string;
  /** The number the next invoice gets, or null to carry on from the highest existing one. */
  next: number | null;
  digits: number;
}

export const PREFIX_PATTERN = /^[A-Za-z0-9\-_/.# ]{0,12}$/;

/** "INV-" + 351 with 4 digits = "INV-0351". */
export function formatInvoiceNumber(s: Pick<NumberingSettings, "prefix" | "digits">, n: number): string {
  return `${s.prefix}${String(n).padStart(s.digits, "0")}`;
}

/** The numeric part of a number that starts with the prefix ("INV-0351" -> 351), or null if it doesn't fit. */
export function numberPart(prefix: string, num: string): number | null {
  if (!num.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const rest = num.slice(prefix.length);
  return /^\d{1,8}$/.test(rest) ? Number(rest) : null;
}

/** Splits something like "XYZ-00412" into its prefix, number and digit count (for reading a number from Xero). */
export function splitInvoiceNumber(num: string): { prefix: string; n: number; digits: number } | null {
  const m = num.trim().match(/^(.*?)(\d{1,8})$/);
  if (!m || m[1].length > 12 || !PREFIX_PATTERN.test(m[1])) return null;
  return { prefix: m[1], n: Number(m[2]), digits: m[2].length };
}

/**
 * The number the next invoice should get. With a "next number" set it is used as is (skipping any already taken);
 * otherwise it carries on from the highest existing number with the same prefix, starting at 1001 as it always has.
 */
export function nextInvoiceNumber(settings: NumberingSettings, existing: string[]): { num: string; n: number } {
  const taken = new Set(existing.map((e) => e.toLowerCase()));
  let n: number;
  if (settings.next != null) {
    n = settings.next;
  } else {
    const max = existing.reduce((m, e) => Math.max(m, numberPart(settings.prefix, e) ?? 0), 1000);
    n = max + 1;
  }
  while (taken.has(formatInvoiceNumber(settings, n).toLowerCase())) n++;
  return { num: formatInvoiceNumber(settings, n), n };
}

export const REFERENCE_PLACEHOLDERS = [
  { key: "job_number", help: "the linked job's number, e.g. J-1033" },
  { key: "client_name", help: "the client's name" },
  { key: "service_address", help: "the service address" },
] as const;

/**
 * Fills a reference template. If any placeholder it uses has no value (no job linked, no address), the whole
 * reference comes out blank rather than leaving half a sentence like "Job ".
 */
export function renderReference(template: string, values: Record<string, string>): string {
  let blank = false;
  const out = template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    const v = (values[key] ?? "").trim();
    if (!v) blank = true;
    return v;
  });
  return blank ? "" : out.trim().slice(0, MAX_REFERENCE_LENGTH);
}
