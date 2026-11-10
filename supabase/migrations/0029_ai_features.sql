-- AI features: Client Service Auditor, Voice-to-Quote/Invoice, temporary job photos with customer gallery links.
-- Everything is per business (org_id) and isolated with the same rules as the rest of the app. The tables that AI jobs
-- write to (ai_requests, audits, gallery links) are written only by the server with the service role.

-- ---------------------------------------------------------------------------
-- 1. Feature switches (Settings > AI Features). Off by default; the plan check happens on the server too.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column ai_auditor_enabled boolean not null default false,
  add column ai_voice_quote_enabled boolean not null default false,
  add column ai_voice_invoice_enabled boolean not null default false;

grant update (ai_auditor_enabled, ai_voice_quote_enabled, ai_voice_invoice_enabled) on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Usage log: every AI call, for cost monitoring, trial allowances and rate limits. Never stores audio,
--    transcripts or customer details; `detail` is a short reason only.
-- ---------------------------------------------------------------------------
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid,
  feature text not null check (feature in ('auditor_summary', 'voice_quote', 'voice_invoice')),
  provider text not null default '',
  model text not null default '',
  status text not null check (status in ('ok', 'error', 'blocked')),
  audio_seconds numeric(8, 2),
  input_tokens integer,
  output_tokens integer,
  cost_usd_est numeric(10, 5),
  detail text,
  created_at timestamptz not null default now()
);
create index ai_requests_org_created_idx on public.ai_requests (org_id, created_at desc);
create index ai_requests_org_user_created_idx on public.ai_requests (org_id, user_id, created_at desc);
alter table public.ai_requests enable row level security;
create policy "ai_requests_select_admin" on public.ai_requests for select using (public.is_admin() and org_id = public.my_org_id());

-- ---------------------------------------------------------------------------
-- 3. Who made a quote/invoice and whether an owner/admin has approved a draft made by staff or by AI.
--    Staff drafts start 'pending' and can't be sent until approved.
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column created_by uuid,
  add column ai_generated boolean not null default false,
  add column approval_status text check (approval_status in ('pending', 'approved')),
  add column approved_by uuid,
  add column approved_at timestamptz;
alter table public.invoices
  add column created_by uuid,
  add column ai_generated boolean not null default false,
  add column approval_status text check (approval_status in ('pending', 'approved')),
  add column approved_by uuid,
  add column approved_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Recurring services: what each client should receive and how often. The auditor reads this.
-- ---------------------------------------------------------------------------
create table public.recurring_services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null default '',
  job_type text not null default 'both',
  frequency text not null check (frequency in ('weekly', 'fortnightly', 'monthly', 'custom')),
  interval_days integer check (interval_days is null or interval_days between 1 and 365),
  -- The first visit date. Monthly visits repeat on this day of the month (clamped to the month's last day).
  anchor_date date not null,
  paused_until date,
  active boolean not null default true,
  -- The repeating-job series this was created from, if any (null = added by hand).
  series_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (frequency <> 'custom' or interval_days is not null)
);
create index recurring_services_org_idx on public.recurring_services (org_id, client_id);
create unique index recurring_services_series_key on public.recurring_services (org_id, series_id) where series_id is not null;
create trigger recurring_services_set_updated_at before update on public.recurring_services for each row execute function public.set_updated_at();
alter table public.recurring_services enable row level security;
create policy "recurring_services_admin" on public.recurring_services for all
  using (public.is_admin() and org_id = public.my_org_id())
  with check (public.is_admin() and org_id = public.my_org_id());

-- One recurring service for every repeating series that already exists (clients' repeating jobs).
insert into public.recurring_services (org_id, client_id, title, job_type, frequency, anchor_date, series_id)
select distinct on (j.series_id)
  j.org_id, j.client_id,
  coalesce(nullif(j.title, ''), initcap(j.job_type) || ' service'),
  j.job_type, j.recurrence,
  (select min(x.job_date) from public.jobs x where x.series_id = j.series_id and x.job_date is not null),
  j.series_id
from public.jobs j
where j.series_id is not null and j.recurrence <> 'none' and j.client_id is not null and j.job_date is not null
order by j.series_id, j.job_date;

-- ---------------------------------------------------------------------------
-- 5. Audit reports (weekly scheduled + manual). One scheduled report per business per week (period_key = the
--    Melbourne Sunday date), enforced here so a retried or duplicated run can't create two.
-- ---------------------------------------------------------------------------
create table public.service_audits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_key text,
  trigger text not null check (trigger in ('scheduled', 'manual')),
  as_of date not null,
  totals jsonb not null default '{}'::jsonb,
  summary text,
  summary_source text check (summary_source in ('ai', 'plain')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index service_audits_period_key on public.service_audits (org_id, period_key) where period_key is not null;
create index service_audits_org_created_idx on public.service_audits (org_id, created_at desc);
alter table public.service_audits enable row level security;
create policy "service_audits_select_admin" on public.service_audits for select using (public.is_admin() and org_id = public.my_org_id());

create table public.service_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.service_audits (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  client_name text not null,
  service_title text not null default '',
  frequency text not null default '',
  interval_days integer,
  last_completed date,
  next_expected date,
  next_scheduled date,
  days_overdue integer not null default 0,
  status text not null check (status in ('overdue', 'not_scheduled', 'upcoming', 'on_track', 'needs_review')),
  reason text not null default ''
);
create index service_audit_items_audit_idx on public.service_audit_items (audit_id);
alter table public.service_audit_items enable row level security;
create policy "service_audit_items_select_admin" on public.service_audit_items for select using (public.is_admin() and org_id = public.my_org_id());

-- ---------------------------------------------------------------------------
-- 6. Job photos: temporary (30 days) unless kept, private storage, compressed on upload.
-- ---------------------------------------------------------------------------
alter table public.job_photos drop constraint if exists job_photos_kind_check;
alter table public.job_photos
  add constraint job_photos_kind_check check (kind in ('before', 'after', 'general')),
  add column expires_at timestamptz not null default (now() + interval '30 days'),
  -- Kept on purpose (contract or record-keeping): the daily cleanup never deletes these.
  add column preserved boolean not null default false,
  add column uploaded_by uuid,
  add column size_bytes integer,
  add column width integer,
  add column height integer,
  add column quote_id uuid references public.quotes (id) on delete set null,
  add column invoice_id uuid references public.invoices (id) on delete set null;
create index job_photos_expiry_idx on public.job_photos (expires_at) where preserved = false;

drop trigger if exists enforce_same_org_refs on public.job_photos;
create trigger enforce_same_org_refs before insert or update on public.job_photos
  for each row execute function public.enforce_same_org_refs('job_id', 'jobs', 'quote_id', 'quotes', 'invoice_id', 'invoices');
drop trigger if exists enforce_same_org_refs on public.recurring_services;
create trigger enforce_same_org_refs before insert or update on public.recurring_services
  for each row execute function public.enforce_same_org_refs('client_id', 'clients');

-- Private bucket: nothing is ever readable by URL. The server hands out short-lived signed links after checking access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Customer gallery links: random token (only its hash is stored), revocable, expiring with the photos.
create table public.photo_gallery_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index photo_gallery_links_job_idx on public.photo_gallery_links (job_id);
create trigger enforce_same_org_refs before insert or update on public.photo_gallery_links
  for each row execute function public.enforce_same_org_refs('job_id', 'jobs');
alter table public.photo_gallery_links enable row level security;
create policy "photo_gallery_links_select_admin" on public.photo_gallery_links for select using (public.is_admin() and org_id = public.my_org_id());
create policy "photo_gallery_links_update_admin" on public.photo_gallery_links for update
  using (public.is_admin() and org_id = public.my_org_id()) with check (public.is_admin() and org_id = public.my_org_id());

-- Log of each cleanup run (what was deleted, what failed), so deletions are auditable.
create table public.photo_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  photos_deleted integer not null default 0,
  files_failed integer not null default 0,
  bytes_freed bigint not null default 0,
  detail text
);
alter table public.photo_cleanup_runs enable row level security;
-- No policies: only the server (service role) reads or writes the cleanup log.

-- ---------------------------------------------------------------------------
-- 7. The weekly audit summary email is logged like other emails.
-- ---------------------------------------------------------------------------
alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in ('quote', 'invoice', 'reminder', 'staff', 'review', 'audit'));
