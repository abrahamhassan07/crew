"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { buildSearchPattern, friendlyDate, orderJobs } from "@/lib/searchCore";
import { todayISO } from "@/lib/design";

export type SearchKind = "client" | "job" | "quote" | "invoice";
export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const PER_KIND = 5;

/**
 * The top bar search: clients, jobs, quotes and invoices in the signed-in person's own business. Runs with their own
 * session, so the database rules decide what they may see (staff only their own jobs; clients are owner/admin only),
 * and every query is also limited to their business explicitly.
 */
export async function searchEverything(raw: string): Promise<SearchHit[]> {
  const pattern = buildSearchPattern(raw);
  if (!pattern) return [];
  const viewer = await getViewer();
  const db = await createClient();
  const org = viewer.orgId;

  const [clientsRes, jobsRes, clientIdsRes] = await Promise.all([
    db.from("clients").select("id, name, company, address, phone, email").eq("org_id", org)
      .or(["name", "company", "email", "phone", "address"].map((c) => `${c}.ilike.${pattern}`).join(","))
      .order("name").limit(PER_KIND),
    db.from("jobs").select("id, num, title, client_name, address, job_date").eq("org_id", org)
      .or(["num", "title", "client_name", "address"].map((c) => `${c}.ilike.${pattern}`).join(","))
      .limit(40),
    // Quotes and invoices are found by their number or by their client's name.
    db.from("clients").select("id, name").eq("org_id", org).or(`name.ilike.${pattern},company.ilike.${pattern}`).limit(50),
  ]);

  const clientIds = (clientIdsRes.data ?? []).map((c) => c.id);
  const byClient = clientIds.length ? `,client_id.in.(${clientIds.join(",")})` : "";
  const [quotesRes, invoicesRes] = await Promise.all([
    db.from("quotes").select("id, num, client_id, status, quote_date").eq("org_id", org).or(`num.ilike.${pattern}${byClient}`).order("quote_date", { ascending: false }).limit(PER_KIND),
    db.from("invoices").select("id, num, client_id, status, issue_date").eq("org_id", org).or(`num.ilike.${pattern}${byClient}`).order("issue_date", { ascending: false }).limit(PER_KIND),
  ]);

  // Names for the clients on the quotes and invoices found.
  const docClientIds = [...new Set([...(quotesRes.data ?? []), ...(invoicesRes.data ?? [])].map((d) => d.client_id))];
  const names = new Map((clientIdsRes.data ?? []).map((c) => [c.id, c.name]));
  const missing = docClientIds.filter((id) => !names.has(id));
  if (missing.length) {
    const { data } = await db.from("clients").select("id, name").eq("org_id", org).in("id", missing);
    for (const c of data ?? []) names.set(c.id, c.name);
  }

  const hits: SearchHit[] = [];
  for (const c of clientsRes.data ?? []) {
    hits.push({ kind: "client", id: c.id, title: c.name, subtitle: [c.company, c.address, c.phone].filter(Boolean).join(" · "), href: `/clients/${c.id}` });
  }
  for (const j of orderJobs(jobsRes.data ?? [], todayISO()).slice(0, PER_KIND)) {
    hits.push({ kind: "job", id: j.id, title: `${j.num} · ${j.client_name}`, subtitle: [friendlyDate(j.job_date) || "Not scheduled", j.title, j.address].filter(Boolean).join(" · "), href: `/jobs/${j.id}` });
  }
  for (const q of quotesRes.data ?? []) {
    hits.push({ kind: "quote", id: q.id, title: `${q.num} · ${names.get(q.client_id) ?? "Client"}`, subtitle: `${q.status} · ${friendlyDate(q.quote_date)}`, href: `/quotes/${q.id}` });
  }
  for (const i of invoicesRes.data ?? []) {
    hits.push({ kind: "invoice", id: i.id, title: `${i.num} · ${names.get(i.client_id) ?? "Client"}`, subtitle: `${i.status} · ${friendlyDate(i.issue_date)}`, href: `/invoices/${i.id}` });
  }
  return hits;
}


