"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { isAppRequest } from "@/lib/inApp";
import { LIMITS, emailKey, ipKey, overLimit, recordAttempt } from "@/lib/authThrottle";

export interface SignInState {
  error?: string;
  // The password was right but this account has two-factor on: ask for the code in place.
  mfa?: boolean;
}

export async function signIn(_prevState: SignInState | undefined, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  // Bot check before the password is tried, so scripted guessing is stopped here. Cloudflare's check can't pass inside
  // the phone app, so there failed attempts are counted and limited instead.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const inApp = await isAppRequest();
  const keys = [emailKey(email), ipKey(ip)];
  if (inApp) {
    const l = LIMITS.signin_failed;
    if (await overLimit("signin_failed", [{ key: keys[0], limit: l.perEmail }, { key: keys[1], limit: l.perIp }])) {
      return { error: `Too many sign-in attempts. Please wait ${l.minutes} minutes and try again.` };
    }
  } else if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") || ""), ip))) {
    return { error: "We couldn't verify you're human. Please wait a moment and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (inApp) await recordAttempt("signin_failed", keys);
    return { error: "Incorrect email or password." };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { mfa: true };
  }

  redirect(next.startsWith("/") ? next : "/");
}
