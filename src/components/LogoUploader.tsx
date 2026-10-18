"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Sprout } from "lucide-react";
import { removeLogo, uploadLogo } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";

/** Upload or remove the business logo. Saves straight away (separate from the Settings "Save changes"). */
export function LogoUploader({ initialUrl, businessName }: { initialUrl: string | null; businessName: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (file.size > 1024 * 1024) {
      setMessage({ text: "That image is too big. Use one under 1 MB.", ok: false });
      return;
    }
    const form = new FormData();
    form.append("logo", file);
    startTransition(async () => {
      const result = await uploadLogo(form);
      if (input.current) input.current.value = "";
      if (!result.ok) {
        setMessage({ text: result.error ?? "Couldn't upload the logo.", ok: false });
        return;
      }
      setUrl(result.url ?? null);
      setMessage({ text: "Logo saved. It now appears on your quotes and invoices.", ok: true });
      router.refresh();
    });
  };

  const remove = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await removeLogo();
      if (!result.ok) {
        setMessage({ text: result.error ?? "Couldn't remove the logo.", ok: false });
        return;
      }
      setUrl(null);
      setMessage({ text: "Logo removed.", ok: true });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 pt-3 pb-4 mb-1 border-b border-line-soft">
      <div className="w-[140px] h-[72px] rounded-lg border border-line bg-page-bg flex items-center justify-center overflow-hidden shrink-0">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from storage
          <img src={url} alt={`${businessName} logo`} className="max-w-full max-h-full object-contain p-1.5" />
        ) : (
          <Sprout className="w-6 h-6 text-ink-muted" />
        )}
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="text-sm font-semibold text-ink-primary">Business logo</div>
        <div className="text-xs text-ink-muted mt-0.5">Shown on your quotes, invoices and their PDFs. PNG or JPEG, under 1 MB. A wide logo on a white or transparent background works best.</div>
        <div className="flex gap-2 mt-2.5">
          <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={pending}>
            <ImageUp className="w-4 h-4" />
            {pending ? "Saving…" : url ? "Replace logo" : "Upload logo"}
          </Button>
          {url && (
            <Button variant="secondary" size="sm" onClick={remove} disabled={pending}>
              Remove
            </Button>
          )}
        </div>
        {message && <p className={`text-xs mt-2 ${message.ok ? "text-ok-fg" : "text-danger"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
