"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SetPasswordState {
  error?: string;
}

export async function setPassword(
  _prevState: SetPasswordState | undefined,
  formData: FormData,
): Promise<SetPasswordState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
