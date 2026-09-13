"use client";

import { useState, useTransition } from "react";
import { addClient, deleteClient, updateClient, type ClientInput } from "@/app/(app)/actions";
import type { CareProvider, Client, Skill } from "@/lib/supabase/types";

export function ClientModal({
  mode,
  client,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  client: Client | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [jobType, setJobType] = useState<Skill>(client?.job_type ?? "both");
  const [careProvider, setCareProvider] = useState<CareProvider | "">(client?.care_provider ?? "");
  const [caseManager, setCaseManager] = useState(client?.case_manager ?? "");
  const [hoursAllocated, setHoursAllocated] = useState(client?.hours_allocated != null ? String(client.hours_allocated) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const input: ClientInput = {
        name,
        address,
        phone,
        email,
        jobType,
        careProvider: careProvider || null,
        caseManager,
        hoursAllocated: hoursAllocated.trim() ? Number(hoursAllocated) : null,
      };
      const result = mode === "new" ? await addClient(input) : await updateClient(client!.id, input);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onSaved(mode === "new" ? "Client added" : "Client updated");
    });
  };

  const remove = () => {
    if (!client) return;
    startTransition(async () => {
      const result = await deleteClient(client.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete client.");
        return;
      }
      onSaved("Client deleted");
    });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-surface shadow-2xl overflow-y-auto p-6 z-101 flex flex-col gap-3.5">
        <div className="font-serif font-semibold text-lg mb-1">{mode === "edit" ? "Edit Client" : "Add Client"}</div>

        <div>
          <label className="block text-sm font-semibold mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Job required</label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value as Skill)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
            <option value="cleaning">Cleaning</option>
            <option value="gardening">Gardening</option>
            <option value="both">Cleaning + Gardening</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Care provider</label>
          <select
            value={careProvider}
            onChange={(e) => setCareProvider(e.target.value as CareProvider | "")}
            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
          >
            <option value="">—</option>
            <option value="AYS">AYS</option>
            <option value="GIHC">GIHC</option>
            <option value="Aurora Home Care">Aurora Home Care</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Case manager</label>
          <input value={caseManager} onChange={(e) => setCaseManager(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Hours allocated</label>
          <input
            type="number"
            min="0"
            step="0.25"
            value={hoursAllocated}
            onChange={(e) => setHoursAllocated(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5 mt-1.5 items-center">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border bg-white text-sm font-medium">
            Cancel
          </button>
          {mode === "edit" && (
            <button
              onClick={remove}
              disabled={pending}
              className="px-4 py-2.5 rounded-lg border text-sm font-semibold"
              style={{ borderColor: "var(--color-danger-border)", background: "var(--color-danger-tint)", color: "var(--color-danger-text)" }}
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={save} disabled={pending} className="px-4.5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
