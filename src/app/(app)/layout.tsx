import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { JobModalProvider } from "@/components/JobModalContext";
import { getViewer } from "@/lib/auth";
import { billingEnforced, getBillingState } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform";

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
    if (billing.kind === "trial") {
      banner = (
        <div className="px-6 py-2.5 bg-info-bg text-info-fg text-sm font-semibold flex flex-wrap items-center justify-between gap-2">
          <span>Free trial: {billing.daysLeft} day{billing.daysLeft === 1 ? "" : "s"} left.</span>
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
      <AppShell role={viewer.profile.role} userName={userName} bizName={bizName} roleLabel={roleLabel} banner={banner} isPlatformAdmin={isPlatformAdmin(viewer.email)}>
        {children}
      </AppShell>
    </JobModalProvider>
  );
}
