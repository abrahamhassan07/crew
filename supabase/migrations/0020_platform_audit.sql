-- History of actions taken by platform owners (resetting someone's two-factor, extending a trial).
-- Written and read only by the server (service role); RLS is on with no policies, so browsers can never touch it.
create table public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index platform_audit_created_idx on public.platform_audit (created_at desc);

alter table public.platform_audit enable row level security;
revoke all on public.platform_audit from anon, authenticated;
