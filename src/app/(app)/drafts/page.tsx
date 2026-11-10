import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffDraftContext } from "@/lib/staffDrafts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");

function stateOf(status: string, approval: string | null) {
  if (status !== "Draft") return { label: status === "Sent" ? "Sent by owner" : status, tone: "text-ok-fg" };
  return approval === "approved" ? { label: "Approved, owner will send", tone: "text-ok-fg" } : { label: "Waiting for approval", tone: "text-warn-fg" };
}

/** A staff member's own quote and invoice drafts. Owners and admins use the normal Quotes and Invoices pages. */
export default async function DraftsPage() {
  const viewer = await getViewer();
  if (viewer.profile.role === "admin") redirect("/quotes");
  const ctx = await staffDraftContext();
  if (!ctx.ok) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: quotes }, { data: invoices }] = await Promise.all([
    admin.from("quotes").select("id, num, status, approval_status, quote_date, client_id").eq("org_id", viewer.orgId).eq("created_by", viewer.userId).order("created_at", { ascending: false }).limit(100),
    admin.from("invoices").select("id, num, status, approval_status, issue_date, client_id").eq("org_id", viewer.orgId).eq("created_by", viewer.userId).order("created_at", { ascending: false }).limit(100),
  ]);
  const clientIds = [...new Set([...(quotes ?? []), ...(invoices ?? [])].map((d) => d.client_id).filter((x): x is string => !!x))];
  const { data: clients } = clientIds.length ? await admin.from("clients").select("id, name").eq("org_id", viewer.orgId).in("id", clientIds) : { data: [] };
  const nameOf = (id: string | null) => (clients ?? []).find((c) => c.id === id)?.name ?? "—";

  const rows = [
    ...(quotes ?? []).map((q) => ({ kind: "quote" as const, id: q.id, num: q.num, client: nameOf(q.client_id), date: q.quote_date, ...stateOf(q.status, q.approval_status) })),
    ...(invoices ?? []).map((i) => ({ kind: "invoice" as const, id: i.id, num: i.num, client: nameOf(i.client_id), date: i.issue_date, ...stateOf(i.status, i.approval_status) })),
  ];

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader
        title="My drafts"
        subtitle="Quotes and invoices you've prepared. Your owner reviews and sends them."
        actions={
          <div className="flex gap-2">
            <Link href="/quotes/new"><Button variant="secondary"><Plus className="w-4 h-4" /> New quote</Button></Link>
            <Link href="/invoices/new"><Button variant="primary"><Plus className="w-4 h-4" /> New invoice</Button></Link>
          </div>
        }
      />
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <Card className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No drafts yet. You can prepare a quote or invoice for any client on a job assigned to you.</p>
          ) : (
            <div className="divide-y divide-line-soft">
              {rows.map((r) => (
                <Link key={`${r.kind}-${r.id}`} href={`/${r.kind === "quote" ? "quotes" : "invoices"}/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-page-bg">
                  <FileText className="w-4 h-4 text-ink-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-primary">{r.kind === "quote" ? "Quote" : "Invoice"} {r.num} · {r.client}</div>
                    <div className="text-xs text-ink-muted">{fmtDate(r.date)}</div>
                  </div>
                  <span className={`text-xs font-semibold ${r.tone}`}>{r.label}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
