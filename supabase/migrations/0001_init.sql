-- Crew & Grounds: core schema, roles, and RLS
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- staff: the roster. One row per staff member; user_id is only set once the
-- staff member has accepted their invite and has a Supabase auth account.
-- ---------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  phone text,
  email text not null,
  skill text not null default 'both' check (skill in ('cleaning', 'gardening', 'both')),
  color_hue smallint not null default 220 check (color_hue between 0 and 360),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.staff.skill is 'What job types this staff member can be assigned: cleaning, gardening, or both.';
comment on column public.staff.color_hue is 'OKLCH hue used to color-code this staff member on the schedule/calendar.';

-- ---------------------------------------------------------------------------
-- profiles: maps a Supabase auth user to an app role (admin or staff) and,
-- for staff, to their staff row. Populated automatically on signup/invite
-- accept via the handle_new_user trigger below, driven by user metadata.
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  address text not null,
  job_type text not null default 'cleaning' check (job_type in ('cleaning', 'gardening', 'both')),
  job_date date not null,
  start_time time not null,
  duration_minutes integer not null default 90 check (duration_minutes > 0),
  assigned_staff_id uuid references public.staff (id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  price numeric(10, 2),
  notes text not null default '',
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'fortnightly', 'monthly')),
  series_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_job_date_idx on public.jobs (job_date);
create index jobs_assigned_staff_id_idx on public.jobs (assigned_staff_id);
create index jobs_series_id_idx on public.jobs (series_id);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile row. Role and staff linkage come from the
-- metadata passed when the user was created:
--   - admin bootstrap: user_metadata.app_role = 'admin'
--   - staff invite:    user_metadata.app_role = 'staff', user_metadata.staff_id = <staff.id>
-- Defaults to a role-less staff profile if metadata is missing.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'app_role';
  meta_staff_id uuid := nullif(new.raw_user_meta_data ->> 'staff_id', '')::uuid;
begin
  insert into public.profiles (user_id, role, staff_id)
  values (new.id, coalesce(meta_role, 'staff'), meta_staff_id)
  on conflict (user_id) do nothing;

  if meta_staff_id is not null then
    update public.staff set user_id = new.id where id = meta_staff_id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper functions for RLS (SECURITY DEFINER so they can read `profiles`
-- without recursing through profiles' own RLS policies).
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create function public.my_staff_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select staff_id from public.profiles where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.staff enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;

-- profiles: everyone can read their own profile; admins can read all.
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (user_id = auth.uid() or public.is_admin());

-- profiles are otherwise only managed by the handle_new_user trigger
-- (security definer), so no insert/update/delete policies for regular roles.

-- staff: admins have full access; a staff member may read their own row.
create policy "staff_select_admin"
on public.staff for select
using (public.is_admin());

create policy "staff_select_self"
on public.staff for select
using (id = public.my_staff_id());

create policy "staff_insert_admin"
on public.staff for insert
with check (public.is_admin());

create policy "staff_update_admin"
on public.staff for update
using (public.is_admin())
with check (public.is_admin());

create policy "staff_delete_admin"
on public.staff for delete
using (public.is_admin());

-- jobs: admins have full access; staff can read and update the status of
-- their own assigned jobs only. The row-level policy lets a staff UPDATE
-- through; the trigger below then rejects it unless only `status` changed.
create policy "jobs_select_admin"
on public.jobs for select
using (public.is_admin());

create policy "jobs_select_own"
on public.jobs for select
using (assigned_staff_id = public.my_staff_id());

create policy "jobs_insert_admin"
on public.jobs for insert
with check (public.is_admin());

create policy "jobs_update_admin_or_own"
on public.jobs for update
using (public.is_admin() or assigned_staff_id = public.my_staff_id())
with check (public.is_admin() or assigned_staff_id = public.my_staff_id());

create policy "jobs_delete_admin"
on public.jobs for delete
using (public.is_admin());

-- Field-level enforcement for non-admins: only `status` may change.
create function public.enforce_job_update_scope()
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
  then
    raise exception 'Staff may only update job status';
  end if;

  return new;
end;
$$;

create trigger jobs_enforce_update_scope
before update on public.jobs
for each row execute function public.enforce_job_update_scope();
