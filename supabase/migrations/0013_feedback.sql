-- In-app feedback from testers. Members can submit for their own business and
-- read back only their own submissions; there is deliberately no update/delete
-- policy, so status changes happen server-side (service role) by the platform
-- owner only.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  kind text not null default 'bug' check (kind in ('bug', 'idea', 'question')),
  title text not null check (char_length(title) between 1 and 200),
  message text not null default '' check (char_length(message) <= 5000),
  page text not null default '' check (char_length(page) <= 500),
  user_agent text not null default '' check (char_length(user_agent) <= 500),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'wont_fix')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_org_id_idx on public.feedback (org_id);
create index feedback_created_at_idx on public.feedback (created_at desc);

create trigger feedback_set_updated_at
before update on public.feedback
for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;
revoke all on public.feedback from anon;

create policy "feedback_insert_own"
on public.feedback for insert to authenticated
with check (user_id = auth.uid() and org_id = public.my_org_id());

create policy "feedback_select_own"
on public.feedback for select to authenticated
using (user_id = auth.uid());
