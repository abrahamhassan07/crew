-- Phone app sign-ins.
--
-- The phone app shows the site in a web view (signed in with the normal site login, including two-factor) and
-- also has native screens that call /api/app/*. Those native screens get their OWN sign-in, made by the site for a
-- person who is already signed in on the site (/api/app/session). Each one is recorded here, and the app endpoints
-- only accept sign-ins listed here and not revoked. A password-only login from elsewhere therefore can't use the app
-- endpoints to get around two-factor.
--
-- Only the server (service role) reads or writes this table. No one gets access through the API.

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- The Supabase auth session this sign-in belongs to (the session_id claim in its tokens).
  session_id uuid not null unique,
  device text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists app_sessions_user_idx on public.app_sessions (user_id);

alter table public.app_sessions enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) can use this table.
revoke all on public.app_sessions from anon, authenticated;
