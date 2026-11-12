import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { GALLERY_URL_SECONDS, hashToken, photosWithUrls } from "@/lib/photos";
import { photosAllowed } from "@/lib/billing";

// The customer's private photo page. Reached only with the secret link. It shows the photos for that one job and the
// business name, nothing else (no client details, no other jobs, no other businesses). Revoked or expired links show
// a plain "no longer available" page, the same for every kind of failure so nothing can be probed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your photos", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const KINDS: { kind: "before" | "after" | "general"; label: string }[] = [
  { kind: "before", label: "Before" },
  { kind: "after", label: "After" },
  { kind: "general", label: "Photos" },
];

const linkUsable = (l: { expires_at: string; revoked_at: string | null }) => !l.revoked_at && new Date(l.expires_at).getTime() > Date.now();

function Unavailable() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-page-bg px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-bold text-ink-primary">This photo link is no longer available</h1>
        <p className="text-sm text-ink-secondary mt-2">It may have expired or been turned off. Please contact the business for a new one.</p>
      </div>
    </main>
  );
}

export default async function GalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return <Unavailable />;
  const admin = createAdminClient();
  const { data: link } = await admin.from("photo_gallery_links").select("org_id, job_id, expires_at, revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link || !linkUsable(link)) return <Unavailable />;

  // Galleries are part of the photos feature: if the business is no longer on a plan with photos, its links stop
  // working (same page as an expired link). They work again if the business upgrades before the link expires.
  const { data: org } = await admin.from("organizations").select("*").eq("id", link.org_id).maybeSingle();
  if (!org || !photosAllowed(org)) return <Unavailable />;
  const [{ data: job }, photos] = await Promise.all([
    admin.from("jobs").select("job_date, title, job_type").eq("id", link.job_id).eq("org_id", link.org_id).maybeSingle(),
    photosWithUrls(link.org_id, link.job_id, null, GALLERY_URL_SECONDS),
  ]);
  if (!job) return <Unavailable />;
  const business = org.name || "Your service provider";
  const when = new Date(job.job_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const shown = photos.filter((p) => p.url);

  return (
    <main className="min-h-screen bg-page-bg px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm font-semibold text-brand">{business}</p>
        <h1 className="text-2xl font-bold text-ink-primary mt-1">Photos from your service</h1>
        <p className="text-sm text-ink-secondary mt-1">{when}</p>
        {!shown.length && <p className="text-sm text-ink-secondary mt-6">There are no photos to show right now.</p>}
        {KINDS.map(({ kind, label }) => {
          const group = shown.filter((p) => p.kind === kind);
          if (!group.length) return null;
          return (
            <section key={kind} className="mt-8">
              <h2 className="text-base font-bold text-ink-primary mb-3">{label}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage link
                  <img key={p.id} src={p.url!} alt={`${label} photo`} className="w-full rounded-lg border border-line bg-card-bg" loading="lazy" referrerPolicy="no-referrer" />
                ))}
              </div>
            </section>
          );
        })}
        <p className="text-xs text-ink-muted mt-10">These photos are temporary and are removed automatically after a while. Save any you want to keep.</p>
      </div>
    </main>
  );
}
