import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { JobModalProvider } from "@/components/JobModalContext";
import { getViewer } from "@/lib/auth";
import { billingEnforced, getBillingState } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform";
import { TRIAL_REMINDER_DAYS } from "@/lib/plans";
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
  if (enforced && billing.kind === "expired") {
    const path = (await headers()).get("x-pathname") ?? "";
    if (viewer.profile.role === "admin" && !path.startsWith("/subscription")) redirect("/subscription");
  }

  let banner: React.ReactNode = null;
  if (enforced && viewer.profile.role === "admin") {
    // Only remind in the last two weeks of the trial; earlier than that it's just noise.
    if (billing.kind === "trial" && billing.daysLeft <= TRIAL_REMINDER_DAYS) {
      const urgent = billing.daysLeft <= 3;
      banner = (
        <div className={`px-6 py-2.5 text-sm font-semibold flex flex-wrap items-center justify-between gap-2 ${urgent ? "bg-warn-bg text-warn-fg" : "bg-info-bg text-info-fg"}`}>
          <span>
            Your free trial ends in {billing.daysLeft} day{billing.daysLeft === 1 ? "" : "s"}. Choose a plan to keep using Crew &amp; Grounds.
          </span>
          <Link href="/subscription" className="underline">Choose a plan</Link>
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

  return (
    <JobModalProvider role={viewer.profile.role}>
      <AppShell role={viewer.profile.role} userName={userName} bizName={bizName} roleLabel={roleLabel} banner={banner} isPlatformAdmin={isPlatformAdmin(viewer.email)} tourAutoStart={!!organization && isWithinDays(organization.created_at, 14)}>
        {children}
      </AppShell>
    </JobModalProvider>
  );
}
