-- One row per quote/invoice emailed through the app, used to enforce a monthly
-- sending cap per business. Written and read only by the server (service role);
-- RLS is on with no policies, so browsers can never touch it.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('quote', 'invoice')),
  created_at timestamptz not null default now()
);

create index email_log_org_month_idx on public.email_log (org_id, created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
