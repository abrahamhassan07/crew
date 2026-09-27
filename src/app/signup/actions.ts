"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: businessName })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message ?? "Could not create your business." };
  }

  const supabase = await createClient();
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { app_role: "admin", org_id: org.id, name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/dashboard`,
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  return { done: true };
}
