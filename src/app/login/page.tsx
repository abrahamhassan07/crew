import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-[10px] bg-accent text-white flex items-center justify-center font-serif font-bold text-[15px] shrink-0">
            CG
          </div>
          <div className="font-serif font-semibold text-lg leading-tight">Crew &amp; Grounds</div>
        </div>
        <h1 className="font-serif font-semibold text-xl mb-1">Sign in</h1>
        <p className="text-sm text-ink-faint mb-6">Use the email and password set up for your account.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
