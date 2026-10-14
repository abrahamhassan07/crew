-- Per-business GST registration. Businesses not registered for GST (e.g. sole
-- traders under the $75k threshold) must not charge it, so quotes and
-- invoices get a third mode, 'none'. Existing orgs stay registered.
alter table public.organizations add column gst_registered boolean not null default true;

do $$
declare
  t text;
  c text;
begin
  foreach t in array array['quotes', 'invoices'] loop
    for c in
      select conname from pg_constraint
      where conrelid = format('public.%I', t)::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%mode%'
    loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
    execute format('alter table public.%I add constraint %I check (mode in (''inclusive'', ''exclusive'', ''none''))', t, t || '_mode_check');
  end loop;
end $$;

-- Column-level grant (see 0011): admins may edit this, but not billing columns.
grant update (gst_registered) on public.organizations to authenticated;
