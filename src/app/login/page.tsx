import { Sprout } from "lucide-react";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const oauthError = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="min-h-screen flex bg-card-bg">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-forest">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute bottom-[-140px] right-[-100px] w-96 h-96 rounded-full bg-brand/25" />
        <div className="absolute top-1/3 right-[-60px] w-56 h-56 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-brand text-white flex items-center justify-center font-serif font-bold text-[15px] shrink-0">
              CG
            </div>
            <span className="font-serif font-semibold text-lg text-white">Crew &amp; Grounds</span>
          </div>

          <div className="max-w-md">
            <h2 className="font-serif font-semibold text-4xl text-white leading-tight mb-4">
              Scheduling made simpler.
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Manage jobs, staff, clients and invoices — all in one place.
            </p>
          </div>

          <div />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-11 h-11 rounded-full bg-ok-bg text-ok-fg flex items-center justify-center mb-5">
              <Sprout className="w-5 h-5" />
            </div>
            <h1 className="font-serif font-semibold text-2xl text-ink-primary mb-1">Welcome back</h1>
            <p className="text-sm text-ink-muted">Log in to your Crew &amp; Grounds account</p>
          </div>

          <LoginForm next={next} oauthError={oauthError} />

          <p className="text-sm text-ink-muted text-center mt-6">
            New business?{" "}
            <a href="/signup" className="text-brand font-semibold">
              Sign up
            </a>
          </p>

          <p className="text-xs text-ink-muted text-center mt-4">
            <a href="/terms" className="hover:text-ink-primary">Terms</a>
            <span className="mx-2">·</span>
            <a href="/privacy" className="hover:text-ink-primary">Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
