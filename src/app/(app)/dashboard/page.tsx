import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { addDays, buildStaffMap, enrichJob, fmtDateLabel, fmtISO, startOfWeek, todayISO } from "@/lib/design";
import { calcTotals } from "@/lib/gst";
import { StatCard, Card } from "@/components/ui/Card";
import { NewJobQuickAction } from "@/components/NewJobQuickAction";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  TrendingUp,
  Users,
  UserPlus,
  FileClock,
  Receipt,
  AlertCircle,
  CheckCircle,
  Activity,
} from "lucide-react";

function fmtAud(v: number) {
  return v.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  const [{ data: jobs }, { data: staffList }, { data: clients }, { data: invoices }, { data: invoiceItems }, { data: payments }, { data: quotes }, { data: quoteItems }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase.from("staff").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("invoice_items").select("invoice_id, qty, unit_price"),
    supabase.from("payments").select("invoice_id, amount, paid_date"),
    supabase.from("quotes").select("*"),
    supabase.from("quote_items").select("quote_id, qty, unit_price"),
  ]);

  const staffById = buildStaffMap(staffList ?? []);
  const enriched = (jobs ?? []).map((j) => enrichJob(j, staffById));

  const today = todayISO();
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = fmtISO(weekStart);
  const weekEndISO = fmtISO(weekEnd);

  const jobsToday = enriched.filter((j) => j.job_date === today);
  const jobsThisWeek = enriched.filter((j) => j.job_date >= weekStartISO && j.job_date <= weekEndISO);
  const unassignedActive = enriched.filter((j) => !j.assigned_staff_id && j.status !== "cancelled" && j.status !== "completed");
  const activeStaffCount = (staffList ?? []).filter((s) => s.active).length;
  const overdueCount = enriched.filter((j) => j.job_date < today && j.status === "scheduled").length;

  // Revenue this month vs last month, from recorded payments.
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const revenueThisMonth = (payments ?? []).filter((p) => new Date(p.paid_date) >= thisMonthStart).reduce((s, p) => s + p.amount, 0);
  const revenueLastMonth = (payments ?? [])
    .filter((p) => new Date(p.paid_date) >= lastMonthStart && new Date(p.paid_date) < thisMonthStart)
    .reduce((s, p) => s + p.amount, 0);
  const revenueDelta = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : null;

  // Outstanding invoices.
  const itemsByInvoice = new Map<string, { qty: number; unit_price: number }[]>();
  for (const item of invoiceItems ?? []) {
    const arr = itemsByInvoice.get(item.invoice_id) ?? [];
    arr.push({ qty: item.qty, unit_price: item.unit_price });
    itemsByInvoice.set(item.invoice_id, arr);
  }
  const paidByInvoice = new Map<string, number>();
  for (const p of payments ?? []) paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + p.amount);
  const openInvoices = (invoices ?? []).filter((i) => ["Sent", "Partially Paid", "Overdue"].includes(i.status));
  const outstandingTotal = openInvoices.reduce((s, i) => {
    const total = calcTotals(itemsByInvoice.get(i.id) ?? [], i.mode).total;
    return s + Math.max(0, total - (paidByInvoice.get(i.id) ?? 0));
  }, 0);
  const overdueInvoiceCount = (invoices ?? []).filter((i) => i.status === "Overdue").length;

  // Active clients + new leads (past 30 days).
  const activeClientCount = (clients ?? []).filter((c) => c.status === "Active").length;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);
  const newLeadsCount = (clients ?? []).filter((c) => c.status === "Lead" && new Date(c.created_at) >= thirtyDaysAgo).length;

  // Quotes awaiting approval.
  const quoteItemsByQuote = new Map<string, { qty: number; unit_price: number }[]>();
  for (const item of quoteItems ?? []) {
    const arr = quoteItemsByQuote.get(item.quote_id) ?? [];
    arr.push({ qty: item.qty, unit_price: item.unit_price });
    quoteItemsByQuote.set(item.quote_id, arr);
  }
  const sentQuotes = (quotes ?? []).filter((q) => q.status === "Sent");
  const sentQuotesValue = sentQuotes.reduce((s, q) => s + calcTotals(quoteItemsByQuote.get(q.id) ?? [], q.mode).total, 0);

  const todaySchedule = jobsToday.slice().sort((a, b) => a.start_time.localeCompare(b.start_time));

  const isAdmin = viewer.profile.role === "admin";

  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const userName = viewer.staff?.name || "there";

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Page header */}
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-ink-muted mb-2">
              {new Date().toLocaleDateString("en-AU", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
            <h1 className="text-3xl font-bold text-ink-primary">
              {greeting}, {userName}
            </h1>
            <p className="text-sm text-ink-secondary mt-1">
              Here&rsquo;s what&rsquo;s happening across your business today.
            </p>
          </div>
          <Link href="/schedule">
            <Button variant="secondary" size="md">
              <Calendar className="w-4 h-4" />
              View schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {isAdmin && (
              <>
                <StatCard
                  label="Revenue this month"
                  value={fmtAud(revenueThisMonth)}
                  icon={<TrendingUp className="w-4 h-4" />}
                  subtitle={revenueLastMonth > 0 ? `vs ${fmtAud(revenueLastMonth)} last month` : "No payments recorded last month"}
                  delta={revenueDelta != null ? { value: `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}%`, trend: revenueDelta >= 0 ? "up" : "down" } : undefined}
                />
                <StatCard
                  label="Outstanding invoices"
                  value={fmtAud(outstandingTotal)}
                  icon={<Receipt className="w-4 h-4" />}
                  subtitle={`${overdueInvoiceCount} overdue · ${openInvoices.length} open`}
                  delta={overdueInvoiceCount > 0 ? { value: "Needs attention", trend: "down" } : undefined}
                />
                <StatCard
                  label="Jobs scheduled today"
                  value={jobsToday.length}
                  icon={<Calendar className="w-4 h-4" />}
                  subtitle={`${jobsThisWeek.length} this week`}
                />
                <StatCard
                  label="Active clients"
                  value={activeClientCount}
                  icon={<Users className="w-4 h-4" />}
                  subtitle={`${activeStaffCount} staff available`}
                />
                <StatCard
                  label="New leads"
                  value={newLeadsCount}
                  icon={<UserPlus className="w-4 h-4" />}
                  subtitle="Past 30 days"
                />
                <StatCard
                  label="Quotes awaiting approval"
                  value={sentQuotes.length}
                  icon={<FileClock className="w-4 h-4" />}
                  subtitle={sentQuotes.length ? `${fmtAud(sentQuotesValue)} total value` : "None outstanding"}
                />
              </>
            )}
            {!isAdmin && (
              <>
                <StatCard
                  label="My Jobs Today"
                  value={jobsToday.length}
                  icon={<Calendar className="w-4 h-4" />}
                />
                <StatCard
                  label="My Jobs This Week"
                  value={jobsThisWeek.length}
                  icon={<Briefcase className="w-4 h-4" />}
                />
              </>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content (left, wider) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Today's schedule */}
              <Card>
                <div className="flex items-center justify-between p-5 border-b border-line-soft">
                  <div>
                    <h2 className="text-lg font-bold text-ink-primary">
                      Today&rsquo;s schedule
                    </h2>
                    <p className="text-xs text-ink-muted mt-1">
                      {jobsToday.length} jobs scheduled
                    </p>
                  </div>
                  <Link href="/schedule">
                    <button className="text-brand text-sm font-semibold hover:text-brand-hover transition-colors flex items-center gap-1">
                      Open schedule <span>→</span>
                    </button>
                  </Link>
                </div>

                {todaySchedule.length > 0 ? (
                  <div className="divide-y divide-line-soft">
                    {todaySchedule.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 hover:bg-page-bg transition-colors cursor-pointer grid grid-cols-[80px_minmax(0,1fr)_auto] gap-3 items-center"
                      >
                        <div>
                          <div className="text-sm font-bold text-ink-primary">
                            {job.start_time}
                          </div>
                          <div className="text-xs text-ink-muted mt-1">
                            {job.duration_minutes}m
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-ink-primary truncate">
                            {job.client_name}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-ink-muted mt-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{job.address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-2 flex-wrap">
                            <span className="font-semibold text-ink-secondary">
                              {job.job_type}
                            </span>
                            {job.assigned_staff_id && job.staffName && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: job.staffColorHex }}
                                />
                                {job.staffName}
                              </span>
                            )}
                          </div>
                        </div>

                        <StatusBadge
                          status={
                            job.status === "in_progress"
                              ? "in-progress"
                              : job.status === "completed"
                                ? "completed"
                                : "scheduled"
                          }
                          label={
                            job.status === "in_progress"
                              ? "In Progress"
                              : job.status === "completed"
                                ? "Completed"
                                : "Scheduled"
                          }
                          showDot
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-ink-muted">
                    No jobs scheduled today.
                  </div>
                )}
              </Card>
            </div>

            {/* Sidebar (right) */}
            <div className="space-y-6">
              {/* Quick actions */}
              <Card className="p-5">
                <h3 className="font-bold text-ink-primary mb-4">Quick actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/clients/new">
                    <button className="p-3 rounded-lg border border-line hover:border-brand hover:bg-ok-tint transition-all text-left">
                      <div className="w-8 h-8 rounded-lg bg-ok-bg text-ok-fg flex items-center justify-center mb-2">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-ink-primary block">
                        New client
                      </span>
                    </button>
                  </Link>

                  <NewJobQuickAction />

                  <Link href="/quotes/new">
                    <button className="p-3 rounded-lg border border-line hover:border-brand hover:bg-ok-tint transition-all text-left">
                      <div className="w-8 h-8 rounded-lg bg-ok-bg text-ok-fg flex items-center justify-center mb-2">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-ink-primary block">
                        New quote
                      </span>
                    </button>
                  </Link>

                  <Link href="/invoices/new">
                    <button className="p-3 rounded-lg border border-line hover:border-brand hover:bg-ok-tint transition-all text-left">
                      <div className="w-8 h-8 rounded-lg bg-ok-bg text-ok-fg flex items-center justify-center mb-2">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-ink-primary block">
                        New invoice
                      </span>
                    </button>
                  </Link>
                </div>
              </Card>

              {/* Alerts/Status */}
              {(overdueCount > 0 || unassignedActive.length > 0) && (
                <div className="bg-bad-bg border border-bad-fg/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-bad-fg flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-bad-fg">
                        Needs attention
                      </div>
                      {overdueCount > 0 && (
                        <p className="text-xs text-bad-fg/80 mt-1">
                          {overdueCount} overdue job{overdueCount > 1 ? "s" : ""}
                        </p>
                      )}
                      {unassignedActive.length > 0 && (
                        <p className="text-xs text-bad-fg/80">
                          {unassignedActive.length} unassigned job
                          {unassignedActive.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
