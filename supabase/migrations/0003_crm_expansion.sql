-- Crew & Grounds: CRM expansion (crews, properties, services, requests,
-- quotes, invoices, payments, equipment, job photos/checklist).
--
-- Additive only: nothing existing is dropped or renamed. clients.address /
-- care_provider / case_manager / hours_allocated and jobs.client_name /
-- assigned_staff_id keep their current meaning and RLS behavior untouched;
-- this migration only adds columns and new tables alongside them.

-- ---------------------------------------------------------------------------
-- crews: groups of staff (a crew has a lead + members via staff.crew_id).
-- ---------------------------------------------------------------------------
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_hex text not null default '#287D32',
  tint_hex text not null default '#E4F2E3',
  lead_staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.staff
  add column crew_id uuid references public.crews (id) on delete set null,
  add column job_role text not null default 'Staff'
    check (job_role in ('Owner', 'Admin', 'Manager', 'Crew Leader', 'Staff'));

comment on column public.staff.job_role is 'Display/permission-flavor role from the prototype (Owner/Admin/Manager/Crew Leader/Staff). Independent of profiles.role, which stays the binary admin/staff column RLS depends on.';

-- ---------------------------------------------------------------------------
-- clients: additive columns for the lead/status funnel.
-- ---------------------------------------------------------------------------
alter table public.clients
  add column company text,
  add column status text not null default 'Active'
    check (status in ('Lead', 'Active', 'Inactive', 'Archived')),
  add column tags text[] not null default '{}',
  add column lead_source text;

-- ---------------------------------------------------------------------------
-- properties: one or more service addresses per client.
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  street text not null default '',
  line2 text not null default '',
  suburb text not null default '',
  state text not null default 'VIC',
  postcode text not null default '',
  country text not null default 'Australia',
  created_at timestamptz not null default now()
);

create index properties_client_id_idx on public.properties (client_id);

-- Backfill one property per existing client from the current flat address
-- text. Best-effort: the whole string goes into `street`; suburb/state/
-- postcode are left for manual cleanup later.
insert into public.properties (client_id, street)
select id, coalesce(address, '')
from public.clients;

-- ---------------------------------------------------------------------------
-- client_contacts / client_notes
-- ---------------------------------------------------------------------------
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  role text not null default 'Other',
  created_at timestamptz not null default now()
);

create index client_contacts_client_id_idx on public.client_contacts (client_id);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  text text not null,
  staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_notes_client_id_idx on public.client_notes (client_id);

-- ---------------------------------------------------------------------------
-- services: the price list. Referenced by jobs/quotes/invoices as a default.
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0 check (price >= 0),
  pricing_type text not null default 'Fixed'
    check (pricing_type in ('Fixed', 'Hourly', 'Per m2', 'Per load')),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  default_crew_id uuid references public.crews (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- requests: the booking-enquiry inbox. May predate any client/property row,
-- so the address is stored flat rather than via a property FK.
-- ---------------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  num text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  phone text,
  email text,
  service_id uuid references public.services (id) on delete set null,
  street text not null default '',
  suburb text not null default '',
  state text not null default 'VIC',
  postcode text not null default '',
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Quoted', 'Converted', 'Closed')),
  preferred_date date,
  description text not null default '',
  source text not null default 'Website',
  received_at timestamptz not null default now()
);

create index requests_client_id_idx on public.requests (client_id);
create index requests_status_idx on public.requests (status);

-- ---------------------------------------------------------------------------
-- quotes / quote_items
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  num text not null unique,
  client_id uuid not null references public.clients (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  quote_date date not null default current_date,
  expiry_date date not null default (current_date + interval '30 days'),
  mode text not null default 'exclusive' check (mode in ('inclusive', 'exclusive')),
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Approved', 'Declined', 'Expired')),
  message text not null default '',
  request_id uuid references public.requests (id) on delete set null,
  job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_client_id_idx on public.quotes (client_id);

create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null default '',
  description text not null default '',
  qty numeric(10, 2) not null default 1,
  unit_price numeric(10, 2) not null default 0,
  sort_order integer not null default 0
);

create index quote_items_quote_id_idx on public.quote_items (quote_id);

-- ---------------------------------------------------------------------------
-- invoices / invoice_items / payments
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  num text not null unique,
  client_id uuid not null references public.clients (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  job_id uuid,
  issue_date date not null default current_date,
  due_date date not null default (current_date + interval '14 days'),
  mode text not null default 'exclusive' check (mode in ('inclusive', 'exclusive')),
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Voided')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_client_id_idx on public.invoices (client_id);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null default '',
  description text not null default '',
  qty numeric(10, 2) not null default 1,
  unit_price numeric(10, 2) not null default 0,
  sort_order integer not null default 0
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_date date not null default current_date,
  method text not null default 'Bank transfer (EFT)',
  reference text not null default '',
  created_at timestamptz not null default now()
);

create index payments_invoice_id_idx on public.payments (invoice_id);

-- ---------------------------------------------------------------------------
-- equipment
-- ---------------------------------------------------------------------------
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text not null default '',
  serial text not null default '',
  crew_id uuid references public.crews (id) on delete set null,
  status text not null default 'In service'
    check (status in ('In service', 'Needs service', 'Out of service')),
  next_service_date date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs: additive columns linking into the richer client/service/crew model.
-- client_name/address/assigned_staff_id keep their current meaning — the
-- existing Reports "Unmatched Jobs" free-text matching keeps working.
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column client_id uuid references public.clients (id) on delete set null,
  add column property_id uuid references public.properties (id) on delete set null,
  add column crew_id uuid references public.crews (id) on delete set null,
  add column service_id uuid references public.services (id) on delete set null,
  add column title text not null default '',
  add column quote_id uuid references public.quotes (id) on delete set null,
  add column checklist jsonb not null default '[]'::jsonb;

alter table public.quotes
  add constraint quotes_job_id_fkey foreign key (job_id) references public.jobs (id) on delete set null;

alter table public.invoices
  add constraint invoices_job_id_fkey foreign key (job_id) references public.jobs (id) on delete set null;

create index jobs_client_id_idx on public.jobs (client_id);
create index jobs_crew_id_idx on public.jobs (crew_id);

-- ---------------------------------------------------------------------------
-- job_photos: before/after photos, stored in Supabase Storage.
-- ---------------------------------------------------------------------------
create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index job_photos_job_id_idx on public.job_photos (job_id);

-- ---------------------------------------------------------------------------
-- Widen staff's allowed job-update scope: a staff member may now also toggle
-- their job's checklist, not just its status (everything else is still
-- admin-only, matching the original trigger's intent).
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
     or new.client_id is distinct from old.client_id
     or new.property_id is distinct from old.property_id
     or new.crew_id is distinct from old.crew_id
     or new.service_id is distinct from old.service_id
     or new.title is distinct from old.title
     or new.quote_id is distinct from old.quote_id
  then
    raise exception 'Staff may only update job status and checklist';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: admin-only for every new table, matching the existing `clients`
-- pattern (staff currently have no direct visibility into client/business
-- data beyond their own assigned jobs and staff row).
-- ---------------------------------------------------------------------------
alter table public.crews enable row level security;
alter table public.properties enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_notes enable row level security;
alter table public.services enable row level security;
alter table public.requests enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.equipment enable row level security;
alter table public.job_photos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'crews', 'properties', 'client_contacts', 'client_notes', 'services',
    'requests', 'quotes', 'quote_items', 'invoices', 'invoice_items',
    'payments', 'equipment', 'job_photos'
  ]
  loop
    execute format('create policy "%s_select_admin" on public.%I for select using (public.is_admin());', t, t);
    execute format('create policy "%s_insert_admin" on public.%I for insert with check (public.is_admin());', t, t);
    execute format('create policy "%s_update_admin" on public.%I for update using (public.is_admin()) with check (public.is_admin());', t, t);
    execute format('create policy "%s_delete_admin" on public.%I for delete using (public.is_admin());', t, t);
  end loop;
end $$;
