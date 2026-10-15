#!/usr/bin/env node
// Creates (or recreates) a fully populated DEMO business for screenshots, screen recordings and ads:
// clients, staff, crews, services, a fortnight either side of today's jobs, quotes, invoices,
// payments, requests and equipment. All names, emails and numbers are made up.
//
//   node scripts/seed-demo.mjs            create it (replaces an existing demo business)
//   node scripts/seed-demo.mjs --remove   delete the demo business and its login
//
// Runs against whatever Supabase project .env.local points at, using the service role. The login is
// written to scripts/.demo-credentials.txt (git-ignored). Reminder and staff emails are switched off and
// every email address is @example.com, so nothing is ever sent to anyone.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of existsSync(new URL("../.env.local", import.meta.url)) ? readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DEMO_EMAIL = "demo-sunbird@example.com";
const BIZ = "Sunbird Lawn & Garden";
const CREDS = new URL("./.demo-credentials.txt", import.meta.url);

const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

// ---- dates (Melbourne) -------------------------------------------------------------------------
const TZ = "Australia/Melbourne";
const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const nowHour = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date()));

// ---- remove any existing demo -------------------------------------------------------------------
async function removeDemo() {
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users.find((u) => u.email === DEMO_EMAIL);
  if (user) {
    const { data: profile } = await db.from("profiles").select("org_id").eq("user_id", user.id).maybeSingle();
    if (profile) await db.from("organizations").delete().eq("id", profile.org_id);
    await db.auth.admin.deleteUser(user.id);
  }
  // A half-finished earlier run can leave a business with no login.
  await db.from("organizations").delete().eq("name", BIZ);
}

await removeDemo();
if (process.argv.includes("--remove")) {
  console.log("Demo business and login removed.");
  process.exit(0);
}

// ---- the business -------------------------------------------------------------------------------
const org = must(
  await db
    .from("organizations")
    .insert({
      name: BIZ,
      email: "hello@sunbirdlawn.example",
      phone: "0400 123 456",
      address: "12 Wattle Street, Brunswick VIC 3056",
      abn: "51 824 753 556",
      gst_registered: true,
      billing_exempt: true, // no trial banner in screenshots
      payment_details: "Account name: Sunbird Lawn & Garden\nBSB: 123-456\nAccount number: 12345678\nPlease use the invoice number as your payment reference.",
    })
    .select("id")
    .single(),
  "organization"
);
const orgId = org.id;
const o = (row) => ({ ...row, org_id: orgId });

// ---- staff and crews ----------------------------------------------------------------------------
const HUES = [15, 190, 280, 330];
const ownerStaff = must(
  await db.from("staff").insert(o({ name: "Jordan Ellis", email: DEMO_EMAIL, phone: "0400 123 456", skill: "both", color_hue: HUES[0], job_role: "Owner", active: true })).select("id").single(),
  "owner staff"
);

const password = randomBytes(9).toString("base64url") + "!9a";
must(
  await db.auth.admin.createUser({
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { app_role: "admin", staff_id: ownerStaff.id, org_id: orgId, name: "Jordan Ellis" },
  }).then((r) => ({ data: r.data, error: r.error })),
  "demo login"
);
writeFileSync(CREDS, `Sunbird Lawn & Garden (demo)\nSign in at https://www.crewandgrounds.com/login\nEmail: ${DEMO_EMAIL}\nPassword: ${password}\nCreated: ${today}\n`);

const team = must(
  await db
    .from("staff")
    .insert([
      o({ name: "Mia Chen", email: "mia.chen@example.com", phone: "0411 222 333", skill: "gardening", color_hue: HUES[1], job_role: "Crew Leader", active: true }),
      o({ name: "Liam O'Brien", email: "liam.obrien@example.com", phone: "0412 333 444", skill: "gardening", color_hue: HUES[2], job_role: "Staff", active: true }),
      o({ name: "Priya Nair", email: "priya.nair@example.com", phone: "0413 444 555", skill: "cleaning", color_hue: HUES[3], job_role: "Crew Leader", active: true }),
    ])
    .select("id, name"),
  "staff"
);
const [mia, liam, priya] = team;

const crews = must(
  await db
    .from("crews")
    .insert([
      o({ name: "Green Team", color_hex: "#2f7d3a", tint_hex: "#e3f1e5", lead_staff_id: mia.id }),
      o({ name: "Sparkle Team", color_hex: "#2b6cb0", tint_hex: "#e2edf8", lead_staff_id: priya.id }),
    ])
    .select("id, name"),
  "crews"
);
const [greenTeam, sparkleTeam] = crews;
await db.from("staff").update({ crew_id: greenTeam.id }).in("id", [mia.id, liam.id]);
await db.from("staff").update({ crew_id: sparkleTeam.id }).eq("id", priya.id);

// ---- services -----------------------------------------------------------------------------------
const services = must(
  await db
    .from("services")
    .insert([
      o({ name: "Lawn mow and edge", description: "Mow, edge and blow clean", price: 65, pricing_type: "Fixed", duration_minutes: 60, category: "Gardening", default_crew_id: greenTeam.id }),
      o({ name: "Hedge trimming", description: "Trim and tidy hedges", price: 85, pricing_type: "Hourly", duration_minutes: 90, category: "Gardening", default_crew_id: greenTeam.id }),
      o({ name: "Garden clean-up", description: "Weeding, pruning, green waste removed", price: 140, pricing_type: "Fixed", duration_minutes: 120, category: "Gardening", default_crew_id: greenTeam.id }),
      o({ name: "Mulching", description: "Supply and spread mulch", price: 180, pricing_type: "Fixed", duration_minutes: 150, category: "Gardening", default_crew_id: greenTeam.id }),
      o({ name: "Standard house clean", description: "Kitchen, bathrooms, floors, dusting", price: 55, pricing_type: "Hourly", duration_minutes: 120, category: "Cleaning", default_crew_id: sparkleTeam.id }),
      o({ name: "End of lease clean", description: "Full bond-back clean", price: 420, pricing_type: "Fixed", duration_minutes: 300, category: "Cleaning", default_crew_id: sparkleTeam.id }),
      o({ name: "Window clean", description: "Inside and out", price: 95, pricing_type: "Fixed", duration_minutes: 90, category: "Cleaning", default_crew_id: sparkleTeam.id }),
    ])
    .select("id, name, price, duration_minutes, category, default_crew_id"),
  "services"
);
const svc = Object.fromEntries(services.map((s) => [s.name, s]));

// ---- clients and addresses ----------------------------------------------------------------------
const CLIENTS = [
  ["Helen Fitzgerald", "14 Banksia Court", "Hawthorn", "3122", "Active", ["Weekly", "Priority"], "Referral", "gardening"],
  ["Marcus & Anna Rossi", "38 Elgin Street", "Carlton", "3053", "Active", ["Fortnightly"], "Website", "both"],
  ["Dr. Susan Whitaker", "7 Glenferrie Road", "Malvern", "3144", "Active", ["Weekly"], "Referral", "cleaning"],
  ["Daniel Okafor", "22 Station Street", "Coburg", "3058", "Active", [], "Google", "gardening"],
  ["Beverley Hartnett", "5 Lakeside Drive", "Albert Park", "3206", "Active", ["Fortnightly", "Priority"], "Referral", "both"],
  ["Tran Family", "61 Smith Street", "Collingwood", "3066", "Active", [], "Website", "cleaning"],
  ["Greg Palmer", "9 Orchard Grove", "Kew", "3101", "Active", ["Weekly"], "Facebook", "gardening"],
  ["Olivia Marsh", "103 High Street", "Northcote", "3070", "Active", [], "Google", "cleaning"],
  ["Peter & Joan Kowalski", "27 Beach Road", "Brighton", "3186", "Active", ["Fortnightly"], "Referral", "gardening"],
  ["Sofia Mendes", "18 Park Lane", "Fitzroy", "3065", "Active", [], "Instagram", "cleaning"],
  ["Hartley Dental Practice", "2/44 Church Street", "Richmond", "3121", "Active", ["Commercial", "Weekly"], "Referral", "cleaning"],
  ["Nathan Brooks", "76 Moreland Road", "Brunswick", "3056", "Lead", [], "Website", "gardening"],
  ["Claire Donovan", "31 Burke Road", "Camberwell", "3124", "Lead", [], "Facebook", "both"],
  ["Walter Ng", "4 Rowan Street", "Preston", "3072", "Inactive", [], "Google", "gardening"],
].map(([name, street, suburb, postcode, status, tags, lead_source, job_type], i) => ({
  name,
  street,
  suburb,
  postcode,
  status,
  tags,
  lead_source,
  job_type,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`,
  phone: `04${10 + i} ${200 + i * 7} ${300 + i * 11}`.slice(0, 12),
}));

const clients = must(
  await db
    .from("clients")
    .insert(CLIENTS.map((c) => o({ name: c.name, email: c.email, phone: c.phone, address: `${c.street}, ${c.suburb} VIC ${c.postcode}`, job_type: c.job_type, status: c.status, tags: c.tags, lead_source: c.lead_source, company: c.name.includes("Practice") ? c.name : null })))
    .select("id, name, address, job_type"),
  "clients"
);
const props = must(
  await db
    .from("properties")
    .insert(clients.map((cl, i) => o({ client_id: cl.id, street: CLIENTS[i].street, line2: "", suburb: CLIENTS[i].suburb, state: "VIC", postcode: CLIENTS[i].postcode, country: "Australia" })))
    .select("id, client_id"),
  "properties"
);
const propByClient = new Map(props.map((p) => [p.client_id, p.id]));
await db.from("client_notes").insert([
  o({ client_id: clients[0].id, text: "Dog in the backyard: ring before entering. Gate code 4471.", staff_id: ownerStaff.id }),
  o({ client_id: clients[1].id, text: "Prefers invoices emailed to both Marcus and Anna.", staff_id: ownerStaff.id }),
  o({ client_id: clients[10].id, text: "Clean after hours, key held in the lockbox by the back door.", staff_id: ownerStaff.id }),
]);

// ---- jobs: a fortnight either side of today ------------------------------------------------------
const gardenSvcs = ["Lawn mow and edge", "Hedge trimming", "Garden clean-up", "Mulching"];
const cleanSvcs = ["Standard house clean", "Window clean", "End of lease clean"];
const gardenStaff = [mia, liam];
const slots = ["08:00", "09:30", "11:00", "13:00", "14:30"];
let seed = 7;
const rnd = (n) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % n;
};

const jobRows = [];
let jobNum = 1000;
const activeClients = clients.filter((_, i) => CLIENTS[i].status === "Active");
for (let d = -12; d <= 13; d++) {
  const date = addDays(today, d);
  if (weekday(date) === 0) continue; // Sundays off
  const perDay = weekday(date) === 6 ? 2 : 3 + rnd(2);
  for (let k = 0; k < perDay; k++) {
    const client = activeClients[(Math.abs(d) * 3 + k * 5 + rnd(4)) % activeClients.length];
    const idx = clients.indexOf(client);
    const cleaning = CLIENTS[idx].job_type === "cleaning" || (CLIENTS[idx].job_type === "both" && k % 2 === 1);
    const picked = (cleaning ? cleanSvcs : gardenSvcs)[rnd(cleaning ? 3 : 4)];
    // A business doesn't get an end of lease clean.
    const s = svc[client.name.includes("Practice") && picked === "End of lease clean" ? "Standard house clean" : picked];
    const staff = cleaning ? priya : gardenStaff[(d + k + 2 * 100) % 2];
    const start = slots[k % slots.length];
    let status = "scheduled";
    if (d < 0) status = rnd(14) === 0 ? "cancelled" : "completed";
    if (d === 0) status = Number(start.slice(0, 2)) + 1 <= nowHour ? "completed" : Number(start.slice(0, 2)) <= nowHour ? "in_progress" : "scheduled";
    jobNum++;
    jobRows.push({
      num: `J-${jobNum}`,
      client_id: client.id,
      client_name: client.name,
      address: client.address,
      property_id: propByClient.get(client.id),
      job_type: cleaning ? "cleaning" : "gardening",
      job_date: date,
      start_time: start,
      duration_minutes: s.duration_minutes,
      assigned_staff_id: staff.id,
      crew_id: cleaning ? sparkleTeam.id : greenTeam.id,
      service_id: s.id,
      title: s.name,
      price: s.price,
      status,
      notes: "",
      recurrence: "none",
      checklist: [],
    });
  }
}
// A couple of unscheduled and unassigned jobs so those views have something in them.
for (const [clientIdx, svcName] of [[3, "Garden clean-up"], [6, "Hedge trimming"]]) {
  jobNum++;
  const client = clients[clientIdx];
  const s = svc[svcName];
  jobRows.push({ num: `J-${jobNum}`, client_id: client.id, client_name: client.name, address: client.address, property_id: propByClient.get(client.id), job_type: "gardening", job_date: null, start_time: null, duration_minutes: s.duration_minutes, assigned_staff_id: null, crew_id: greenTeam.id, service_id: s.id, title: s.name, price: s.price, status: "scheduled", notes: "", recurrence: "none", checklist: [] });
}
// One upcoming job with a checklist and notes, to show off the detail view.
const detailJob = jobRows.find((j) => j.job_date && j.job_date > today && j.job_type === "gardening");
detailJob.notes = "Side gate is stiff: lift while pushing. Green waste bin is behind the shed.";
detailJob.checklist = [
  { t: "Mow front and back lawns", done: false },
  { t: "Edge paths and driveway", done: false },
  { t: "Blow clean and bag clippings", done: false },
];
const jobs = must(await db.from("jobs").insert(jobRows.map(o)).select("id, num, client_id, job_date, status, price"), "jobs");

// ---- requests ---------------------------------------------------------------------------------
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
must(
  await db.from("requests").insert([
    o({ num: "R-1001", name: "Claire Donovan", email: "claire.donovan@example.com", phone: "0421 555 019", client_id: clients[12].id, service_id: svc["Garden clean-up"].id, street: "31 Burke Road", suburb: "Camberwell", postcode: "3124", status: "New", preferred_date: addDays(today, 6), description: "Overgrown back garden before we list the house. Mostly weeds and some tree branches.", source: "Website", received_at: daysAgo(0.2) }),
    o({ num: "R-1002", name: "Nathan Brooks", email: "nathan.brooks@example.com", phone: "0422 555 020", client_id: clients[11].id, service_id: svc["Lawn mow and edge"].id, street: "76 Moreland Road", suburb: "Brunswick", postcode: "3056", status: "Contacted", preferred_date: addDays(today, 4), description: "Fortnightly lawn mow, small front and back yard.", source: "Website", received_at: daysAgo(1.5) }),
    o({ num: "R-1003", name: "Amelia Grant", email: "amelia.grant@example.com", phone: "0423 555 021", service_id: svc["End of lease clean"].id, street: "8/12 Napier Street", suburb: "Fitzroy", postcode: "3065", status: "New", preferred_date: addDays(today, 12), description: "2 bed apartment end of lease clean, inspection on the 28th.", source: "Facebook", received_at: daysAgo(0.6) }),
  ]),
  "requests"
);

// ---- quotes and invoices ----------------------------------------------------------------------
const money = (n) => Math.round(n * 100) / 100;
const quoteSpecs = [
  [1, "Approved", -9, [["Mulching", 2], ["Garden clean-up", 1]]],
  [4, "Approved", -5, [["Hedge trimming", 3]]],
  [8, "Sent", -2, [["End of lease clean", 1]]],
  [11, "Sent", -1, [["Lawn mow and edge", 1], ["Garden clean-up", 1]]],
  [12, "Draft", 0, [["Garden clean-up", 2], ["Mulching", 1]]],
  [9, "Declined", -14, [["Window clean", 2]]],
];
let qn = 1000;
for (const [ci, status, offset, items] of quoteSpecs) {
  qn++;
  const quote = must(
    await db.from("quotes").insert(o({ num: `Q-${qn}`, client_id: clients[ci].id, property_id: propByClient.get(clients[ci].id), quote_date: addDays(today, offset), expiry_date: addDays(today, offset + 30), mode: "exclusive", status, message: "Thanks for the opportunity to quote. Prices are valid for 30 days." })).select("id").single(),
    "quote"
  );
  must(await db.from("quote_items").insert(items.map(([name, qty], i) => o({ quote_id: quote.id, service_id: svc[name].id, service_name: name, description: svc[name].description ?? "", qty, unit_price: svc[name].price, sort_order: i }))), "quote items");
}

const completed = jobs.filter((j) => j.status === "completed");
const invoiceSpecs = [
  // [client index, status, issue offset, due offset, items, paid fraction]
  [0, "Paid", -26, -12, [["Lawn mow and edge", 4]], 1],
  [2, "Paid", -22, -8, [["Standard house clean", 3]], 1],
  [4, "Paid", -18, -4, [["Hedge trimming", 2], ["Garden clean-up", 1]], 1],
  [6, "Paid", -13, 1, [["Lawn mow and edge", 3]], 1],
  [10, "Partially Paid", -11, 3, [["Standard house clean", 6]], 0.5],
  [1, "Sent", -6, 8, [["Mulching", 2]], 0],
  [3, "Sent", -3, 11, [["Garden clean-up", 1]], 0],
  [7, "Overdue", -24, -10, [["Window clean", 2]], 0],
  [5, "Draft", 0, 14, [["Standard house clean", 4]], 0],
];
let inn = 1000;
for (const [ci, status, issueOff, dueOff, items, paidFrac] of invoiceSpecs) {
  inn++;
  const job = completed.find((j) => j.client_id === clients[ci].id);
  const invoice = must(
    await db.from("invoices").insert(o({ num: `INV-${inn}`, client_id: clients[ci].id, property_id: propByClient.get(clients[ci].id), job_id: job?.id ?? null, issue_date: addDays(today, issueOff), due_date: addDays(today, dueOff), mode: "exclusive", status, notes: "Account name: Sunbird Lawn & Garden\nBSB: 123-456\nAccount number: 12345678\nPlease use the invoice number as your payment reference." })).select("id").single(),
    "invoice"
  );
  must(await db.from("invoice_items").insert(items.map(([name, qty], i) => o({ invoice_id: invoice.id, service_id: svc[name].id, service_name: name, description: svc[name].description ?? "", qty, unit_price: svc[name].price, sort_order: i }))), "invoice items");
  if (paidFrac > 0) {
    const sub = items.reduce((s, [name, qty]) => s + svc[name].price * qty, 0);
    const total = money(sub * 1.1);
    const paidDate = addDays(today, Math.min(0, Math.max(issueOff + 6, -(Number(today.slice(8)) - 2))));
    must(await db.from("payments").insert(o({ invoice_id: invoice.id, amount: money(total * paidFrac), paid_date: paidDate, method: "Bank transfer (EFT)", reference: `INV-${inn}` })), "payment");
  }
}

// ---- equipment --------------------------------------------------------------------------------
must(
  await db.from("equipment").insert([
    o({ name: "Honda HRU196 mower", model: "HRU196", serial: "MZCG-7712043", crew_id: greenTeam.id, status: "In service", next_service_date: addDays(today, 40) }),
    o({ name: "Stihl hedge trimmer", model: "HS 82 R", serial: "S-4419027", crew_id: greenTeam.id, status: "Needs service", next_service_date: addDays(today, 5) }),
    o({ name: "Echo line trimmer", model: "SRM-2620", serial: "E-9983110", crew_id: greenTeam.id, status: "In service", next_service_date: addDays(today, 62) }),
    o({ name: "Kärcher vacuum", model: "WD 6 P", serial: "K-2207651", crew_id: sparkleTeam.id, status: "In service", next_service_date: addDays(today, 90) }),
  ]),
  "equipment"
);

console.log(`Demo business "${BIZ}" created: ${clients.length} clients, ${jobs.length} jobs, ${quoteSpecs.length} quotes, ${invoiceSpecs.length} invoices, 3 requests, 4 staff.`);
console.log(`Login details saved to scripts/.demo-credentials.txt`);
