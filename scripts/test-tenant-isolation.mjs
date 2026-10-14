#!/usr/bin/env node
// Cross-tenant isolation test. Creates two throwaway businesses (org + admin
// user each), seeds rows as each user, then checks that neither can read,
// update, delete or insert into the other's data. Cleans up after itself.
// Usage: npm run test:isolation   (uses .env.local; hits whichever Supabase project it points at)
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const line of existsSync(new URL("../.env.local", import.meta.url)) ? readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const tag = randomUUID().slice(0, 8);
const password = `Iso-${randomUUID()}`;
const tenants = [];
let failures = 0;
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  -> ${detail}` : ""}`);
}

async function makeTenant(label) {
  const { data: org, error: orgErr } = await admin.from("organizations").insert({ name: `ISOTEST ${label} ${tag}` }).select("id").single();
  if (orgErr) throw new Error(`org insert: ${orgErr.message}`);
  const email = `isotest-${label.toLowerCase()}-${tag}@example.com`;
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { app_role: "admin", org_id: org.id },
  });
  if (userErr) throw new Error(`user create: ${userErr.message}`);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign in: ${signInErr.message}`);
  const t = { label, orgId: org.id, userId: created.user.id, email, db: client };
  tenants.push(t);
  return t;
}

async function seed(t) {
  const ins = async (table, row) => {
    const { data, error } = await t.db.from(table).insert({ ...row, org_id: t.orgId }).select("id").single();
    if (error) throw new Error(`${t.label} seed ${table}: ${error.message}`);
    return data.id;
  };
  const clientId = await ins("clients", { name: `${t.label} Client ${tag}` });
  const propertyId = await ins("properties", { client_id: clientId, street: "1 Test St", suburb: "Testville", state: "VIC", postcode: "3000" });
  await ins("client_contacts", { client_id: clientId, name: "Contact" });
  await ins("client_notes", { client_id: clientId, text: "note" });
  const crewId = await ins("crews", { name: `${t.label} Crew ${tag}` });
  const serviceId = await ins("services", { name: `${t.label} Service ${tag}` });
  const staffId = await ins("staff", { name: `${t.label} Staff ${tag}`, email: `staff-${t.label}-${tag}@example.com` });
  const jobId = await ins("jobs", { client_name: `${t.label} Client ${tag}`, address: "1 Test St", job_type: "cleaning", client_id: clientId, property_id: propertyId, num: `J-${tag}-${t.label}` });
  const requestId = await ins("requests", { client_id: clientId, name: "Req", num: `R-${tag}-${t.label}` });
  const quoteId = await ins("quotes", { num: `Q-${tag}-${t.label}`, client_id: clientId });
  await ins("quote_items", { quote_id: quoteId, service_name: "item", qty: 1, unit_price: 10 });
  const invoiceId = await ins("invoices", { num: `I-${tag}-${t.label}`, client_id: clientId });
  await ins("invoice_items", { invoice_id: invoiceId, service_name: "item", qty: 1, unit_price: 10 });
  await ins("payments", { invoice_id: invoiceId, amount: 5 });
  await ins("equipment", { name: `${t.label} Mower ${tag}` });
  t.ids = { clientId, jobId, quoteId, invoiceId, staffId, crewId, serviceId, requestId };
}

const TABLES = ["clients", "properties", "client_contacts", "client_notes", "crews", "services", "staff", "jobs", "requests", "quotes", "quote_items", "invoices", "invoice_items", "payments", "equipment"];

async function run() {
  const [a, b] = [await makeTenant("A"), await makeTenant("B")];
  await seed(a);
  await seed(b);

  for (const [me, other] of [[a, b], [b, a]]) {
    for (const table of TABLES) {
      const { data, error } = await me.db.from(table).select("*");
      const leaked = (data ?? []).filter((r) => r.org_id && r.org_id !== me.orgId);
      check(`${me.label} cannot read ${other.label}'s ${table}`, !error && leaked.length === 0 && (data ?? []).length > 0, error?.message ?? `leaked=${leaked.length} own=${(data ?? []).length}`);
    }

    const { data: orgs } = await me.db.from("organizations").select("id");
    check(`${me.label} sees only its own organization`, (orgs ?? []).length === 1 && orgs[0].id === me.orgId, JSON.stringify(orgs));

    const { data: profiles } = await me.db.from("profiles").select("user_id, org_id");
    check(`${me.label} sees only its own org's profiles`, (profiles ?? []).every((p) => p.org_id === me.orgId) && (profiles ?? []).length >= 1, JSON.stringify(profiles));

    // Writes against the other tenant's rows must affect nothing.
    const upd = await me.db.from("clients").update({ name: "HACKED" }).eq("id", other.ids.clientId).select("id");
    check(`${me.label} cannot update ${other.label}'s client`, !upd.error && (upd.data ?? []).length === 0, JSON.stringify(upd));
    const updJob = await me.db.from("jobs").update({ price: 999999 }).eq("id", other.ids.jobId).select("id");
    check(`${me.label} cannot update ${other.label}'s job`, !updJob.error && (updJob.data ?? []).length === 0, JSON.stringify(updJob));
    const del = await me.db.from("invoices").delete().eq("id", other.ids.invoiceId).select("id");
    check(`${me.label} cannot delete ${other.label}'s invoice`, !del.error && (del.data ?? []).length === 0, JSON.stringify(del));

    // Inserting into the other org must be rejected.
    const forge = await me.db.from("clients").insert({ name: "forged", org_id: other.orgId }).select("id");
    check(`${me.label} cannot insert a client into ${other.label}'s org`, !!forge.error || (forge.data ?? []).length === 0, JSON.stringify(forge));

    // Re-parenting own rows into the other org must be rejected.
    const move = await me.db.from("clients").update({ org_id: other.orgId }).eq("id", me.ids.clientId).select("id");
    check(`${me.label} cannot move its client into ${other.label}'s org`, !!move.error || (move.data ?? []).length === 0, JSON.stringify(move));

    // Linking own records to the other tenant's client must not be possible.
    const links = [
      ["quote for", "quotes", { num: `X1-${tag}-${me.label}`, client_id: other.ids.clientId }, "client"],
      ["invoice for", "invoices", { num: `X2-${tag}-${me.label}`, client_id: other.ids.clientId }, "client"],
      ["job for", "jobs", { client_name: "x", address: "x", job_type: "cleaning", num: `X3-${tag}-${me.label}`, client_id: other.ids.clientId }, "client"],
      ["job assigned to", "jobs", { client_name: "x", address: "x", job_type: "cleaning", num: `X4-${tag}-${me.label}`, assigned_staff_id: other.ids.staffId }, "staff member"],
      ["payment on", "payments", { invoice_id: other.ids.invoiceId, amount: 1 }, "invoice"],
      ["property on", "properties", { client_id: other.ids.clientId, street: "x", suburb: "x", state: "VIC", postcode: "3000" }, "client"],
    ];
    for (const [verb, table, row, noun] of links) {
      const res = await me.db.from(table).insert({ ...row, org_id: me.orgId }).select("id");
      check(`${me.label} cannot create a ${verb} ${other.label}'s ${noun}`, !!res.error || (res.data ?? []).length === 0, JSON.stringify(res));
    }

    const relink = await me.db.from("jobs").update({ client_id: other.ids.clientId }).eq("id", me.ids.jobId).select("id");
    check(`${me.label} cannot re-point its job at ${other.label}'s client`, !!relink.error || (relink.data ?? []).length === 0, JSON.stringify(relink));
  }

  // Billing columns must only be writable by the server (Stripe webhook), never by a business admin.
  for (const t of [a, b]) {
    const grab = await t.db.from("organizations").update({ subscription_status: "active", billing_exempt: true }).eq("id", t.orgId).select("id");
    check(`${t.label} cannot mark its own org as paid/exempt`, !!grab.error || (grab.data ?? []).length === 0, JSON.stringify(grab));
    const rename = await t.db.from("organizations").update({ name: `ISOTEST ${t.label} ${tag}`, gst_registered: false }).eq("id", t.orgId).select("id");
    check(`${t.label} can still edit its business details and GST setting`, !rename.error && (rename.data ?? []).length === 1, JSON.stringify(rename));
    const noGst = await t.db.from("quotes").insert({ num: `NG-${tag}-${t.label}`, client_id: t.ids.clientId, org_id: t.orgId, mode: "none" }).select("id");
    check(`${t.label} can create a no-GST quote`, !noGst.error && (noGst.data ?? []).length === 1, JSON.stringify(noGst));
    const { data: row } = await admin.from("organizations").select("billing_exempt, subscription_status, trial_ends_at").eq("id", t.orgId).single();
    check(`${t.label} new org is on a trial, not exempt`, row?.billing_exempt === false && !row?.subscription_status && new Date(row?.trial_ends_at) > new Date(), JSON.stringify(row));
  }

  // Feedback: submit for yourself only, read only your own, never edit or delete.
  {
    const fb = await a.db.from("feedback").insert({ org_id: a.orgId, user_id: a.userId, user_email: a.email, title: "isotest", kind: "bug" }).select("id").single();
    check("A can submit feedback", !fb.error, JSON.stringify(fb.error));
    const bSees = await b.db.from("feedback").select("id");
    check("B cannot read A's feedback", (bSees.data ?? []).length === 0);
    const spoof = await b.db.from("feedback").insert({ org_id: a.orgId, user_id: b.userId, title: "spoof" }).select("id");
    check("B cannot submit feedback into A's business", !!spoof.error || (spoof.data ?? []).length === 0);
    const edit = await a.db.from("feedback").update({ status: "done" }).eq("id", fb.data?.id).select("id");
    check("A cannot change feedback status", !!edit.error || (edit.data ?? []).length === 0);
  }

  // Confirm the victim's data really is untouched.
  const { data: untouched } = await admin.from("clients").select("name").eq("id", a.ids.clientId).single();
  check("A's client name unchanged after B's attempted update", untouched?.name === `A Client ${tag}`, untouched?.name);
}

async function cleanup() {
  for (const t of tenants) {
    await admin.auth.admin.deleteUser(t.userId).catch(() => {});
    await admin.from("organizations").delete().eq("id", t.orgId);
  }
  const { data: left } = await admin.from("organizations").select("id").like("name", `ISOTEST % ${tag}`);
  console.log(`cleanup: ${left?.length ? `WARNING ${left.length} test org(s) remain` : "test orgs removed"}`);
}

try {
  await run();
} catch (e) {
  failures++;
  console.error("ERROR", e.message);
} finally {
  await cleanup();
}
console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
