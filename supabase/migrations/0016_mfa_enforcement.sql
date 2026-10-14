-- Two-factor sign-in, enforced in the database. A user who has turned on an
-- authenticator app only gets data access from a session that has passed the
-- code check (JWT claim aal = 'aal2'); a password-only (aal1) session sees
-- nothing, even if someone calls the API directly with the public key.
-- Users without a verified factor are unaffected. The service role bypasses RLS.
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
      );
$$;

revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'staff', 'jobs', 'clients', 'properties', 'client_contacts',
    'client_notes', 'crews', 'services', 'requests', 'quotes', 'quote_items', 'invoices',
    'invoice_items', 'payments', 'equipment', 'job_photos', 'feedback'
  ] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))',
      t
    );
  end loop;
end $$;
