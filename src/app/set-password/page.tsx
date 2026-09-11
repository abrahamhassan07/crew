import { SetPasswordForm } from "./SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <h1 className="font-serif font-semibold text-xl mb-1">Set your password</h1>
        <p className="text-sm text-ink-faint mb-6">
          Choose a password for your Crew &amp; Grounds account.
        </p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
