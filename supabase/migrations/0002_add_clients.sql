-- Crew & Grounds: client directory
-- ---------------------------------------------------------------------------
-- clients: the admin-managed client directory. Independent of jobs (which
-- still store client_name/address as free text) — this is the record of
-- ongoing service recipients: contact info, the job type they require, the
-- care/funding body, their case manager, and hours allocated.
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  job_type text not null default 'both' check (job_type in ('cleaning', 'gardening', 'both')),
  care_provider text check (care_provider in ('AYS', 'GIHC', 'Aurora Home Care')),
  case_manager text,
  hours_allocated numeric(5, 2) check (hours_allocated >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.clients.job_type is 'What job type this client requires: cleaning, gardening, or both.';
comment on column public.clients.care_provider is 'The care/funding body for this client: AYS, GIHC, or Aurora Home Care.';
comment on column public.clients.hours_allocated is 'Hours allocated per service period for this client.';

create index clients_name_idx on public.clients (name);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: admin-only, mirroring staff.
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;

create policy "clients_select_admin"
on public.clients for select
using (public.is_admin());

create policy "clients_insert_admin"
on public.clients for insert
with check (public.is_admin());

create policy "clients_update_admin"
on public.clients for update
using (public.is_admin())
with check (public.is_admin());

create policy "clients_delete_admin"
on public.clients for delete
using (public.is_admin());
