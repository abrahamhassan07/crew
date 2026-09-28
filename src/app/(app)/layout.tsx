import { AppShell } from "@/components/shell/AppShell";
import { JobModalProvider } from "@/components/JobModalContext";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data: organization } = await supabase.from("organizations").select("name").eq("id", viewer.orgId).single();

  const userName = viewer.staff?.name || viewer.name || viewer.email;
  const bizName = organization?.name ?? "";
  const roleLabel = viewer.staff?.job_role ?? (viewer.profile.role === "admin" ? "Owner" : "Staff");

  return (
    <JobModalProvider role={viewer.profile.role}>
      <AppShell role={viewer.profile.role} userName={userName} bizName={bizName} roleLabel={roleLabel}>
        {children}
      </AppShell>
    </JobModalProvider>
  );
}
