-- Phone app push notifications.
--
-- When someone allows notifications in the phone app, the app sends its Expo push token here (/api/app/push). Each
-- token belongs to one app sign-in (app_sessions). Pushes are only sent while that sign-in is live: signing out of the
-- app, a revoked sign-in or a long idle period stops them, so a phone that is signed out never shows job details.
--
-- Only the server (service role) reads or writes this table. No one gets access through the API.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  app_session_id uuid not null references public.app_sessions (id) on delete cascade,
  -- An Expo push token such as ExponentPushToken[...]. One phone has one token, so a new sign-in on the same phone
  -- takes the token over.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
create index if not exists push_tokens_org_idx on public.push_tokens (org_id);

alter table public.push_tokens enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) can use this table.
revoke all on public.push_tokens from anon, authenticated;
