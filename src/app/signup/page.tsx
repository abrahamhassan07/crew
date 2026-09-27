import { Sprout } from "lucide-react";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
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
              Run your business, your way.
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              A fully separate account for your business — jobs, staff, clients and invoices, all in one place.
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
            <h1 className="font-serif font-semibold text-2xl text-ink-primary mb-1">Create your business</h1>
            <p className="text-sm text-ink-muted">Set up a new, fully separate account for your business</p>
          </div>

          <SignupForm oauthError={oauthError} />

          <p className="text-sm text-ink-muted text-center mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-brand font-semibold">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
