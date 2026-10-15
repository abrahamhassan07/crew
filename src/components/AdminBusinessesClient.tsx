"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ShieldOff } from "lucide-react";
import { extendTrial, resetTwoFactor } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";

export interface AdminUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  twoFactor: boolean;
  lastSignIn: string | null;
}

export interface AdminBusiness {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  billing: string;
  billingKind: "exempt" | "active" | "trial" | "expired";
  reminders: boolean;
  staffNotifications: boolean;
  clients: number;
  jobs: number;
  documentsEmailed: number;
  notificationsEmailed: number;
  users: AdminUser[];
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export function AdminBusinessesClient({ businesses }: { businesses: AdminBusiness[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) => [b.name, b.email ?? "", ...b.users.map((u) => u.email)].join(" ").toLowerCase().includes(q));
  }, [businesses, query]);

  const totalUsers = businesses.reduce((n, b) => n + b.users.length, 0);

  const run = (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      setMessage({ text: result.ok ? success : result.error ?? "Something went wrong.", ok: result.ok });
      if (result.ok) router.refresh();
    });
  };

  const reset = (u: AdminUser) => {
    if (!window.confirm(`Turn off two-factor for ${u.email}? They will be able to sign in with just their password until they set it up again.`)) return;
    run(() => resetTwoFactor(u.userId), `Two-factor turned off for ${u.email}.`);
  };

  const extend = (b: AdminBusiness) => {
    if (!window.confirm(`Add 14 days to the free trial for ${b.name}?`)) return;
    run(() => extendTrial(b.id, 14), `Added 14 days to ${b.name}.`);
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <PageHeader title="Businesses" subtitle={`${businesses.length} businesses, ${totalUsers} users. Only platform owners can see this page.`} />
      <div className="px-6 py-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <SearchInput value={query} onChange={setQuery} placeholder="Search businesses or user emails…" className="max-w-sm" />
            {message && <span className={`text-sm ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</span>}
          </div>

          <div className="flex flex-col gap-2.5">
            {shown.map((b) => {
              const isOpen = open === b.id;
              return (
                <div key={b.id} className="bg-card-bg border border-line rounded-lg">
                  <button onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen} className="w-full flex items-center gap-4 px-4 py-3 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-primary truncate">{b.name}</div>
                      <div className="text-xs text-ink-muted truncate">{b.email ?? "No business email"} · joined {fmt(b.createdAt)}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-xs text-ink-secondary shrink-0">
                      <span>{b.users.length} user{b.users.length === 1 ? "" : "s"}</span>
                      <span>{b.clients} clients</span>
                      <span>{b.jobs} jobs</span>
                      <span className={b.billingKind === "expired" ? "text-danger font-semibold" : "font-semibold"}>{b.billing}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-ink-muted shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-line-soft px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2">Users</h3>
                        <div className="divide-y divide-line-soft">
                          {b.users.map((u) => (
                            <div key={u.userId} className="flex items-center gap-3 py-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-ink-primary truncate">{u.name || u.email}</div>
                                <div className="text-xs text-ink-muted truncate">
                                  {u.name ? `${u.email} · ` : ""}
                                  {u.role} · last sign-in {fmt(u.lastSignIn)}
                                </div>
                              </div>
                              {u.twoFactor ? (
                                <>
                                  <span className="text-xs font-semibold text-ok-fg">Two-factor on</span>
                                  <Button variant="secondary" size="sm" onClick={() => reset(u)} disabled={pending}>
                                    <ShieldOff className="w-3.5 h-3.5" />
                                    Reset
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-ink-muted">Two-factor off</span>
                              )}
                            </div>
                          ))}
                          {b.users.length === 0 && <div className="text-sm text-ink-muted py-2">No users.</div>}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2">This month</h3>
                        <dl className="text-sm grid grid-cols-[1fr_auto] gap-y-1">
                          <dt className="text-ink-secondary">Quotes and invoices emailed</dt>
                          <dd className="font-semibold">{b.documentsEmailed}</dd>
                          <dt className="text-ink-secondary">Reminders and staff emails</dt>
                          <dd className="font-semibold">{b.notificationsEmailed}</dd>
                          <dt className="text-ink-secondary">Customer reminders</dt>
                          <dd>{b.reminders ? "On" : "Off"}</dd>
                          <dt className="text-ink-secondary">Staff notifications</dt>
                          <dd>{b.staffNotifications ? "On" : "Off"}</dd>
                        </dl>
                        {b.billingKind !== "exempt" && b.billingKind !== "active" && (
                          <Button variant="secondary" size="sm" className="mt-3" onClick={() => extend(b)} disabled={pending}>
                            Extend trial by 14 days
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && <div className="bg-card-bg border border-line rounded-lg p-8 text-center text-ink-muted text-sm">No businesses match.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
