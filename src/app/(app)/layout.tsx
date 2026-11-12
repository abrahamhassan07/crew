import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { JobModalProvider } from "@/components/JobModalContext";
import { getViewer } from "@/lib/auth";
import { aiAllowed, billingEnforced, getBillingState } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform";
import { FREE_PLAN, TRIAL_REMINDER_DAYS } from "@/lib/plans";
import { isWithinDays } from "@/lib/design";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data: organization } = await supabase.from("organizations").select("*").eq("id", viewer.orgId).single();

  const userName = viewer.staff?.name || viewer.name || viewer.email;
  const bizName = organization?.name ?? "";
  const roleLabel = viewer.staff?.job_role ?? (viewer.profile.role === "admin" ? "Owner" : "Staff");

  const billing = getBillingState(organization);
  const enforced = billingEnforced();

  let banner: React.ReactNode = null;
  if (enforced && viewer.profile.role === "admin") {
    // Only remind in the last two weeks of the trial; earlier than that it's just noise.
    if (billing.kind === "trial" && billing.daysLeft <= TRIAL_REMINDER_DAYS) {
      const urgent = billing.daysLeft <= 3;
      banner = (
        <div className={`px-6 py-2.5 text-sm font-semibold flex flex-wrap items-center justify-between gap-2 ${urgent ? "bg-warn-bg text-warn-fg" : "bg-info-bg text-info-fg"}`}>
          <span>
            Your free trial ends in {billing.daysLeft} day{billing.daysLeft === 1 ? "" : "s"}. After that you&rsquo;ll move to the Free plan ({FREE_PLAN.users} user, {FREE_PLAN.invoices} invoices a month) unless you choose a plan.
          </span>
          <Link href="/subscription" className="underline">See plans</Link>
        </div>
      );
    } else if (billing.kind === "active" && billing.status === "past_due") {
      banner = (
        <div className="px-6 py-2.5 bg-warn-bg text-warn-fg text-sm font-semibold flex flex-wrap items-center justify-between gap-2">
          <span>Your last payment didn&rsquo;t go through.</span>
          <Link href="/subscription" className="underline">Update billing</Link>
        </div>
      );
    }
  }

  const isAdmin = viewer.profile.role === "admin";
  const staffDrafts = !isAdmin && !!organization?.staff_drafts_enabled && aiAllowed(organization);
  // Floating mic (phones): owners need AI on their plan; staff need staff drafts on. The server checks again on every recording.
  const voiceOk = isAdmin ? aiAllowed(organization) : staffDrafts;
  const voice = { quote: voiceOk && !!organization?.ai_voice_quote_enabled, invoice: voiceOk && !!organization?.ai_voice_invoice_enabled };
  const [{ count: pendingQuotes }, { count: pendingInvoices }] = isAdmin
    ? await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      ])
    : [{ count: 0 }, { count: 0 }];

  return (
    <JobModalProvider role={viewer.profile.role}>
      <AppShell role={viewer.profile.role} userId={viewer.userId} userName={userName} bizName={bizName} roleLabel={roleLabel} banner={banner} isPlatformAdmin={isPlatformAdmin(viewer.email)} staffDrafts={staffDrafts} voice={voice} pending={{ quotes: pendingQuotes ?? 0, invoices: pendingInvoices ?? 0 }} tourAutoStart={!!organization && isWithinDays(organization.created_at, 14)}>
        {children}
      </AppShell>
    </JobModalProvider>
  );
}
