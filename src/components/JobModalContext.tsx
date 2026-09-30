"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JobModal, type ClientOption, type StaffOption } from "@/components/JobModal";
import { StaffJobDrawer } from "@/components/StaffJobDrawer";
import { ToastBanner, useToast } from "@/components/Toast";
import { formatPropertyAddress } from "@/lib/design";
import type { AppRole } from "@/lib/supabase/types";
import type { Job } from "@/lib/supabase/types";

/**
 * clients.address is a legacy flat field left over from before the
 * properties table existed — it's empty for virtually every client added
 * through the app now, so pull the address from their first property
 * instead (same "primary property" convention as the client profile page).
 */
async function loadClientOptions(supabase: ReturnType<typeof createClient>): Promise<ClientOption[]> {
  const [{ data: clients }, { data: properties }] = await Promise.all([
    supabase.from("clients").select("id, name, address, job_type").order("name"),
    supabase.from("properties").select("client_id, street, line2, suburb, state, postcode").order("created_at"),
  ]);

  const primaryAddressByClient = new Map<string, string>();
  for (const p of properties ?? []) {
    if (!primaryAddressByClient.has(p.client_id)) primaryAddressByClient.set(p.client_id, formatPropertyAddress(p));
  }

  return (clients ?? []).map((c) => ({ ...c, address: primaryAddressByClient.get(c.id) ?? c.address }));
}

interface JobModalState {
  mode: "new" | "edit";
  jobId: string | null;
  prefillDate?: string;
}

interface JobModalContextValue {
  openNewJob: (prefillDate?: string) => void;
  openJob: (jobId: string) => void;
}

const JobModalCtx = createContext<JobModalContextValue | null>(null);

export function useJobModal() {
  const ctx = useContext(JobModalCtx);
  if (!ctx) throw new Error("useJobModal must be used within JobModalProvider");
  return ctx;
}

export function JobModalProvider({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, showToast } = useToast();
  const [state, setState] = useState<JobModalState | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    setState(null);
    setJob(null);
  }, []);

  const openNewJob = useCallback(
    (prefillDate?: string) => {
      setState({ mode: "new", jobId: null, prefillDate });
      setJob(null);
      if (role === "admin") {
        setLoading(true);
        const supabase = createClient();
        Promise.all([
          supabase.from("staff").select("id, name").eq("active", true).order("name"),
          loadClientOptions(supabase),
        ]).then(([staffRes, clientOpts]) => {
          setStaffOptions(staffRes.data ?? []);
          setClientOptions(clientOpts);
          setLoading(false);
        });
      }
    },
    [role],
  );

  const openJob = useCallback(
    (jobId: string) => {
      setState({ mode: "edit", jobId });
      setLoading(true);
      const supabase = createClient();
      const jobPromise = supabase.from("jobs").select("*").eq("id", jobId).single();
      const staffPromise =
        role === "admin"
          ? supabase.from("staff").select("id, name").eq("active", true).order("name")
          : Promise.resolve({ data: [] as StaffOption[] });
      const clientsPromise = role === "admin" ? loadClientOptions(supabase) : Promise.resolve([] as ClientOption[]);

      Promise.all([jobPromise, staffPromise, clientsPromise]).then(([jobRes, staffRes, clientOpts]) => {
        setJob(jobRes.data ?? null);
        setStaffOptions(staffRes.data ?? []);
        setClientOptions(clientOpts);
        setLoading(false);
      });
    },
    [role],
  );

  const onSaved = useCallback(
    (message: string) => {
      close();
      showToast(message);
      // A delete from the job's own detail page (/jobs/[id]) leaves that
      // page pointed at a job that no longer exists — refreshing it just
      // 404s. Send the user back to the list instead in that one case.
      if (message === "Job deleted" && pathname.startsWith("/jobs/")) {
        router.push("/jobs");
      } else {
        router.refresh();
      }
    },
    [close, showToast, router, pathname],
  );

  const value = useMemo(() => ({ openNewJob, openJob }), [openNewJob, openJob]);

  return (
    <JobModalCtx.Provider value={value}>
      {children}
      {state && !loading && role === "admin" && (
        <JobModal
          mode={state.mode}
          job={job}
          prefillDate={state.prefillDate}
          staffOptions={staffOptions}
          clientOptions={clientOptions}
          onClose={close}
          onSaved={onSaved}
        />
      )}
      {state && !loading && role === "staff" && job && (
        <StaffJobDrawer job={job} onClose={close} onSaved={onSaved} />
      )}
      <ToastBanner message={toast} />
    </JobModalCtx.Provider>
  );
}
