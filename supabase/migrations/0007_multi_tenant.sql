-- Multi-tenant conversion: organizations + org_id on every business table,
-- org-scoped RLS, and org-aware signup provisioning.
--
-- Every table touched here already has admin-only (or admin-or-self) RLS
-- from earlier migrations; this narrows those policies to the caller's own
-- organisation rather than introducing new access rules. Existing
-- single-tenant production data is migrated into one seed organisation.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  abn text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seed org for existing data, then add org_id (nullable -> backfill -> not
-- null, mirroring the jobs.num pattern from 0005) to every tenant table.
-- ---------------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  t text;
begin
  insert into public.organizations (name) values ('Nature''s Palette')
  returning id into v_org_id;

  foreach t in array array[
    'profiles', 'staff', 'jobs', 'clients', 'properties', 'client_contacts',
    'client_notes', 'crews', 'services', 'requests', 'quotes', 'quote_items',
    'invoices', 'invoice_items', 'payments', 'equipment', 'job_photos'
  ]
  loop
    execute format('alter table public.%I add column org_id uuid references public.organizations (id) on delete cascade;', t);
    execute format('update public.%I set org_id = %L;', t, v_org_id);
    execute format('alter table public.%I alter column org_id set not null;', t);
    execute format('create index %I on public.%I (org_id);', t || '_org_id_idx', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Per-org number sequences: widen the existing single-column uniques.
-- ---------------------------------------------------------------------------
alter table public.jobs drop constraint jobs_num_unique;
alter table public.jobs add constraint jobs_num_org_unique unique (org_id, num);

alter table public.quotes drop constraint quotes_num_key;
alter table public.quotes add constraint quotes_num_org_unique unique (org_id, num);

alter table public.invoices drop constraint invoices_num_key;
alter table public.invoices add constraint invoices_num_org_unique unique (org_id, num);

alter table public.requests drop constraint requests_num_key;
alter table public.requests add constraint requests_num_org_unique unique (org_id, num);

-- ---------------------------------------------------------------------------
-- my_org_id(): mirrors my_staff_id()'s shape, security definer to avoid
-- recursing through profiles' own RLS.
-- ---------------------------------------------------------------------------
create function public.my_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.profiles where user_id = auth.uid();
$$;

-- organizations: any signed-in member can read their own org (for
-- Settings/invoice display); only an admin can update it. Rows are created
-- exclusively via the service-role client (staff invite, self-signup), so
-- there's no authenticated insert/delete policy.
alter table public.organizations enable row level security;

create policy "organizations_select_own"
on public.organizations for select
using (id = public.my_org_id());

create policy "organizations_update_admin"
on public.organizations for update
using (public.is_admin() and id = public.my_org_id())
with check (public.is_admin() and id = public.my_org_id());

-- ---------------------------------------------------------------------------
-- Narrow every admin-only policy (clients + the 13 CRM-expansion tables) to
-- the caller's own org.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'crews', 'properties', 'client_contacts', 'client_notes',
    'services', 'requests', 'quotes', 'quote_items', 'invoices',
    'invoice_items', 'payments', 'equipment', 'job_photos'
  ]
  loop
    execute format('alter policy "%s_select_admin" on public.%I using (public.is_admin() and org_id = public.my_org_id());', t, t);
    execute format('alter policy "%s_insert_admin" on public.%I with check (public.is_admin() and org_id = public.my_org_id());', t, t);
    execute format('alter policy "%s_update_admin" on public.%I using (public.is_admin() and org_id = public.my_org_id()) with check (public.is_admin() and org_id = public.my_org_id());', t, t);
    execute format('alter policy "%s_delete_admin" on public.%I using (public.is_admin() and org_id = public.my_org_id());', t, t);
  end loop;
end $$;

-- profiles: fix the cross-tenant leak this would otherwise become — an
-- admin must only see profiles within their own org, not every org's.
alter policy "profiles_select_own_or_admin" on public.profiles
using (user_id = auth.uid() or (public.is_admin() and org_id = public.my_org_id()));

-- staff
alter policy "staff_select_admin" on public.staff
using (public.is_admin() and org_id = public.my_org_id());

alter policy "staff_select_self" on public.staff
using (id = public.my_staff_id() and org_id = public.my_org_id());

alter policy "staff_insert_admin" on public.staff
with check (public.is_admin() and org_id = public.my_org_id());

alter policy "staff_update_admin" on public.staff
using (public.is_admin() and org_id = public.my_org_id())
with check (public.is_admin() and org_id = public.my_org_id());

alter policy "staff_delete_admin" on public.staff
using (public.is_admin() and org_id = public.my_org_id());

-- jobs
alter policy "jobs_select_admin" on public.jobs
using (public.is_admin() and org_id = public.my_org_id());

alter policy "jobs_select_own" on public.jobs
using (assigned_staff_id = public.my_staff_id() and org_id = public.my_org_id());

alter policy "jobs_insert_admin" on public.jobs
with check (public.is_admin() and org_id = public.my_org_id());

alter policy "jobs_update_admin_or_own" on public.jobs
using ((public.is_admin() or assigned_staff_id = public.my_staff_id()) and org_id = public.my_org_id())
with check ((public.is_admin() or assigned_staff_id = public.my_staff_id()) and org_id = public.my_org_id());

alter policy "jobs_delete_admin" on public.jobs
using (public.is_admin() and org_id = public.my_org_id());

-- ---------------------------------------------------------------------------
-- enforce_job_update_scope(): block org_id from non-admin updates (staff
-- must never move a job between orgs), and restore the column protections
-- 0005's replace silently dropped (client_id/property_id/crew_id/service_id/
-- title/quote_id were unintentionally left editable by non-admin staff).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_job_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.client_name is distinct from old.client_name
     or new.address is distinct from old.address
     or new.job_type is distinct from old.job_type
     or new.job_date is distinct from old.job_date
     or new.start_time is distinct from old.start_time
     or new.duration_minutes is distinct from old.duration_minutes
     or new.assigned_staff_id is distinct from old.assigned_staff_id
     or new.price is distinct from old.price
     or new.notes is distinct from old.notes
     or new.recurrence is distinct from old.recurrence
     or new.series_id is distinct from old.series_id
     or new.num is distinct from old.num
     or new.client_id is distinct from old.client_id
     or new.property_id is distinct from old.property_id
     or new.crew_id is distinct from old.crew_id
     or new.service_id is distinct from old.service_id
     or new.title is distinct from old.title
     or new.quote_id is distinct from old.quote_id
     or new.org_id is distinct from old.org_id
  then
    raise exception 'Staff may only update job status and checklist';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user(): both signup paths (staff invite, new-business
-- self-signup) now pass org_id explicitly in user metadata, so the trigger
-- just reads it — profiles.org_id is not null, so a signup that reaches
-- this trigger without a valid org_id rolls back the whole auth.users
-- insert, making stray/unscoped accounts impossible even via the raw API.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'app_role';
  meta_staff_id uuid := nullif(new.raw_user_meta_data ->> 'staff_id', '')::uuid;
  meta_org_id uuid := (new.raw_user_meta_data ->> 'org_id')::uuid;
begin
  insert into public.profiles (user_id, role, staff_id, org_id)
  values (new.id, coalesce(meta_role, 'staff'), meta_staff_id, meta_org_id)
  on conflict (user_id) do nothing;

  if meta_staff_id is not null then
    update public.staff set user_id = new.id where id = meta_staff_id;
  end if;

  return new;
end;
$$;
