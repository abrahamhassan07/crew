-- Sign-in and sign-up attempts made from the phone app.
--
-- On the website, Cloudflare Turnstile stops scripted password guessing and sign-up spam. Turnstile can't pass inside
-- an app's web view, so app requests skip it and are limited by counting attempts here instead (src/lib/authThrottle.ts).
-- Only the server (service role) reads or writes this table; it has row level security on and no policies.

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('signin_failed', 'signup')),
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_attempts_lookup on public.auth_attempts (kind, key, created_at desc);

alter table public.auth_attempts enable row level security;
revoke all on table public.auth_attempts from anon, authenticated;
