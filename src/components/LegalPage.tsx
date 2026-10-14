import Link from "next/link";
import { Sprout } from "lucide-react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-card-bg">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2 font-serif font-semibold text-ink-primary">
            <span className="w-8 h-8 rounded-full bg-ok-bg text-ok-fg flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </span>
            Crew &amp; Grounds
          </Link>
          <nav className="flex gap-5 text-sm font-semibold text-brand">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-serif font-semibold text-3xl text-ink-primary mb-1">{title}</h1>
        <p className="text-sm text-ink-muted mb-10">Last updated {updated}</p>
        <div className="text-[15px] leading-relaxed text-ink-secondary [&_h2]:font-serif [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:text-ink-primary [&_h2]:mt-9 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1.5 [&_a]:text-brand [&_a]:font-semibold">
          {children}
        </div>
      </main>
    </div>
  );
}
