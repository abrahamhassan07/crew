import "server-only";

export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;

/**
 * Verifies a Cloudflare Turnstile token. When TURNSTILE_SECRET_KEY isn't set the check is
 * skipped, so local development and a not-yet-configured deployment keep working.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
