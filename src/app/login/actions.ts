"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { mfa: true };
  }

  redirect(next.startsWith("/") ? next : "/");
}
