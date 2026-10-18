// Business logos live in the public "logos" storage bucket (see migration 0023).
export const LOGO_BUCKET = "logos";
export const LOGO_MAX_BYTES = 1024 * 1024;

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
}
