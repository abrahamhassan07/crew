import { Sprout } from "lucide-react";
import { MfaChallengeForm } from "./MfaChallengeForm";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-card-bg p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-11 h-11 rounded-full bg-ok-bg text-ok-fg flex items-center justify-center mb-5">
            <Sprout className="w-5 h-5" />
          </div>
          <h1 className="font-serif font-semibold text-2xl text-ink-primary mb-1">Two-factor sign-in</h1>
          <p className="text-sm text-ink-muted">Enter the 6-digit code from your authenticator app</p>
        </div>
        <MfaChallengeForm next={next} supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@crewandgrounds.com"} />
      </div>
    </div>
  );
}
