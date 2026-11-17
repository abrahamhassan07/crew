-- Phone app sign-ins and two-factor.
--
-- 0016 only gives data to sessions whose token says the two-factor code was entered (aal2). The app's native
-- screens use their own sign-in, made by the site (/api/app/session) for someone already signed in there, and that
-- new session's token is always aal1. So anyone with two-factor on saw nothing in the app ("Signing you in…" forever).
--
-- The site only makes an app sign-in from a site session that has passed two-factor (when the person has it on), and
-- now records that here. mfa_ok() also accepts a session listed here with mfa_verified, as long as it hasn't been
-- revoked (signing out of the app, or of the site inside the app, revokes it at once).

alter table public.app_sessions add column if not exists mfa_verified boolean not null default false;

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified'
      )
      or exists (
        select 1 from public.app_sessions s
        where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
          and s.user_id = auth.uid()
          and s.mfa_verified
          and s.revoked_at is null
      );
$$;

revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated;
