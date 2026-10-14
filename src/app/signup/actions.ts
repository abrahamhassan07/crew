"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { createOwnerStaff } from "@/lib/provision";
import { verifyTurnstile } from "@/lib/turnstile";

export interface SignUpState {
  error?: string;
  done?: boolean;
}

export async function signUp(_prevState: SignUpState | undefined, formData: FormData): Promise<SignUpState> {
  const businessName = String(formData.get("businessName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!businessName) return { error: "Business name is required." };
  if (!name) return { error: "Your name is required." };
  if (!email) return { error: "Email is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  // Bot check first, before anything is created or any email is sent.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") || ""), ip))) {
    return { error: "We couldn't verify you're human. Please wait a moment and try again." };
  }

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: businessName })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message ?? "Could not create your business." };
  }

  // The owner is also assignable staff; handle_new_user() links this row to the login.
  const staffId = await createOwnerStaff(admin, org.id, name, email);

  const supabase = await createClient();
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { app_role: "admin", org_id: org.id, name, ...(staffId ? { staff_id: staffId } : {}) },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/dashboard`,
    },
  });

  // Supabase answers a sign-up for an already-registered email with a fake success
  // (no identities) so it can't be used to discover accounts; don't leave a stray business behind.
  const alreadyRegistered = !signUpError && data.user?.identities?.length === 0;
  if (signUpError || alreadyRegistered) {
    await admin.from("organizations").delete().eq("id", org.id);
    return { error: alreadyRegistered ? "An account with this email already exists. Try logging in instead." : signUpError!.message };
  }

  return { done: true };
}
