import { AppShell } from "@/components/AppShell";
import { JobModalProvider } from "@/components/JobModalContext";
import { getViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const viewerLabel = viewer.staff ? viewer.staff.name : "Owner · Admin";

  return (
    <JobModalProvider role={viewer.profile.role}>
      <AppShell role={viewer.profile.role} viewerLabel={viewerLabel}>
        {children}
      </AppShell>
    </JobModalProvider>
  );
}
