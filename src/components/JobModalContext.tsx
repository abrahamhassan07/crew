"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JobModal, type ClientOption, type StaffOption } from "@/components/JobModal";
import { StaffJobDrawer } from "@/components/StaffJobDrawer";
import { ToastBanner, useToast } from "@/components/Toast";
import type { AppRole } from "@/lib/supabase/types";
import type { Job } from "@/lib/supabase/types";

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
          supabase.from("clients").select("id, name, address, job_type").order("name"),
        ]).then(([staffRes, clientsRes]) => {
          setStaffOptions(staffRes.data ?? []);
          setClientOptions(clientsRes.data ?? []);
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
      const clientsPromise =
        role === "admin"
          ? supabase.from("clients").select("id, name, address, job_type").order("name")
          : Promise.resolve({ data: [] as ClientOption[] });

      Promise.all([jobPromise, staffPromise, clientsPromise]).then(([jobRes, staffRes, clientsRes]) => {
        setJob(jobRes.data ?? null);
        setStaffOptions(staffRes.data ?? []);
        setClientOptions(clientsRes.data ?? []);
        setLoading(false);
      });
    },
    [role],
  );

  const onSaved = useCallback(
    (message: string) => {
      close();
      showToast(message);
      router.refresh();
    },
    [close, showToast, router],
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
