"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, Check, Copy, Download, Link2, Pin, PinOff, Trash2 } from "lucide-react";
import { createGalleryLink, deleteJobPhoto, loadJobPhotos, revokeGalleryLink, setPhotoPreserved, type PhotoPanelData } from "@/app/(app)/photoActions";
import { Button } from "@/components/ui/Button";
import { PHOTO_MAX_BYTES, daysLeft } from "@/lib/photoFiles";

type Kind = "before" | "after" | "general";
const KINDS: { kind: Kind; label: string }[] = [
  { kind: "before", label: "Before" },
  { kind: "after", label: "After" },
  { kind: "general", label: "General" },
];

/** Shrinks a photo in the browser to a JPEG no wider than 1600px. Re-drawing it also drops location data and fixes rotation. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 5; attempt++) {
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const quality = attempt === 0 ? 0.72 : 0.6;
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= Math.min(PHOTO_MAX_BYTES, 900 * 1024)) return blob;
    if (blob && attempt === 4 && blob.size <= PHOTO_MAX_BYTES) return blob;
    scale *= 0.8;
  }
  throw new Error("too big");
}

/** Before / after / general photos for a job. Photos are temporary: removed after 30 days unless kept. */
export function JobPhotosPanel({ jobId }: { jobId: string }) {
  const [data, setData] = useState<PhotoPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("before");
  const [shareDays, setShareDays] = useState(7);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await loadJobPhotos(jobId);
    if (!res.ok) return setError(res.error);
    setData(res.data);
  }, [jobId]);
  useEffect(() => {
    let live = true;
    void loadJobPhotos(jobId).then((res) => {
      if (!live) return;
      if (!res.ok) setError(res.error);
      else setData(res.data);
    });
    return () => {
      live = false;
    };
  }, [jobId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      setBusy(`Uploading ${file.name}…`);
      try {
        if (!file.type.startsWith("image/")) throw new Error("Only photos can be added.");
        const blob = await compress(file);
        const form = new FormData();
        form.append("jobId", jobId);
        form.append("kind", kind);
        form.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        const res = await fetch("/api/photos", { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Couldn't upload that photo.");
      } catch (e) {
        setError(e instanceof Error && e.message !== "too big" ? e.message : "That photo couldn't be shrunk enough. Try a different one.");
        break;
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    await refresh();
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      await refresh();
    });
  };

  const share = () => {
    setError(null);
    setNewLink(null);
    startTransition(async () => {
      const res = await createGalleryLink(jobId, shareDays);
      if (!res.ok) return setError(res.error);
      setNewLink(`${window.location.origin}/g/${res.token}`);
      await refresh();
    });
  };

  const photos = data?.photos ?? [];
  const isAdmin = data?.isAdmin ?? false;
  const activeLinks = data?.links ?? []; // the server only returns links that are still active

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-base font-bold text-ink-primary">Job photos</h2>
        {isAdmin && photos.length > 0 && (
          <a href={`/api/photos/export?job=${jobId}`} className="text-sm font-semibold text-brand inline-flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Download all
          </a>
        )}
      </div>
      <p className="text-xs text-ink-muted mb-3">Photos are deleted automatically 30 days after they&apos;re added{isAdmin ? ", unless you keep them" : ""}. They&apos;re compressed and location data is removed.</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex rounded-lg border border-line overflow-hidden">
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => setKind(k.kind)} className={`px-3 h-9 text-sm font-semibold ${kind === k.kind ? "bg-brand text-white" : "bg-card-bg text-ink-secondary"}`}>
              {k.label}
            </button>
          ))}
        </div>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
        <Button variant="primary" size="md" onClick={() => input.current?.click()} disabled={!!busy}>
          <Camera className="w-4 h-4" /> Add {kind} photo
        </Button>
      </div>
      {busy && <p className="text-sm text-ink-secondary mb-2">{busy}</p>}
      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      {!data && !error && <p className="text-sm text-ink-muted">Loading photos…</p>}
      {data && photos.length === 0 && <p className="text-sm text-ink-muted">No photos yet.</p>}

      {KINDS.map(({ kind: k, label }) => {
        const group = photos.filter((p) => p.kind === k);
        if (!group.length) return null;
        return (
          <div key={k} className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-muted mb-2">{label}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {group.map((p) => (
                <div key={p.id} className="rounded-lg border border-line overflow-hidden bg-page-bg">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage link
                    <img src={p.url} alt={`${label} photo`} className="w-full aspect-square object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center text-xs text-ink-muted">Unavailable</div>
                  )}
                  <div className="px-2 py-1.5 flex items-center justify-between gap-1 text-xs">
                    <span className="text-ink-muted">{p.preserved ? "Kept" : `${daysLeft(p.expires_at)}d left`}</span>
                    <span className="flex items-center gap-1.5">
                      {isAdmin && (
                        <button title={p.preserved ? "Let it expire" : "Keep this photo"} onClick={() => run(() => setPhotoPreserved(p.id, !p.preserved))} className="text-ink-secondary">
                          {p.preserved ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </button>
                      )}
                      {(isAdmin || p.mine) && (
                        <button
                          title="Delete photo"
                          onClick={() => {
                            if (window.confirm("Delete this photo? This can't be undone.")) run(() => deleteJobPhoto(p.id));
                          }}
                          className="text-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {isAdmin && photos.length > 0 && (
        <div className="border-t border-line pt-4 mt-2">
          <div className="text-sm font-bold text-ink-primary mb-1 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Share with the customer</div>
          <p className="text-xs text-ink-muted mb-2">Creates a private link that shows only this job&apos;s photos. You can turn it off any time. Nothing is sent automatically.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={shareDays} onChange={(e) => setShareDays(Number(e.target.value))} className="h-9 rounded-lg border border-line bg-card-bg px-2 text-sm">
              <option value={3}>Expires in 3 days</option>
              <option value={7}>Expires in 7 days</option>
              <option value={14}>Expires in 14 days</option>
              <option value={30}>Expires in 30 days</option>
            </select>
            <Button variant="secondary" size="md" onClick={share}>Create link</Button>
          </div>
          {newLink && (
            <div className="mt-3 p-3 rounded-lg bg-ok-bg border border-ok-fg/25 text-sm">
              <div className="font-semibold text-ok-fg mb-1">Link created. Copy it now, it won&apos;t be shown again.</div>
              <div className="flex items-center gap-2">
                <input readOnly value={newLink} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 h-9 rounded-md border border-line bg-white px-2 text-xs" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(newLink);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}
          {activeLinks.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {activeLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
                  <span>Active link, expires {new Date(l.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                  <button className="font-semibold text-danger" onClick={() => run(() => revokeGalleryLink(l.id))}>Turn off</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
