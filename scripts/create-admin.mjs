#!/usr/bin/env node
// One-time bootstrap: creates the Owner/Admin account against the local
// (or linked) Supabase project. Usage:
//   npm run create-admin -- --email you@example.com --password "..."
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email") out.email = args[++i];
    if (args[i] === "--password") out.password = args[++i];
    if (args[i] === "--name") out.name = args[++i];
  }
  return out;
}

loadEnvLocal();
const { email, password, name } = parseArgs();

if (!email || !password) {
  console.error('Usage: npm run create-admin -- --email you@example.com --password "..." [--name "Your Name"]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { app_role: "admin", name: name ?? "Owner" },
});

if (error) {
  console.error("Failed to create admin user:", error.message);
  process.exit(1);
}

console.log(`Admin account created for ${data.user.email}. You can now sign in at /login.`);
