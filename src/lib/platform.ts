// The platform owner(s): comma-separated emails in PLATFORM_ADMIN_EMAILS. They can
// see feedback from every business. Emails are verified by Supabase before an
// account is usable, so matching on email is safe.
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return !!email && platformAdminEmails().includes(email.toLowerCase());
}
