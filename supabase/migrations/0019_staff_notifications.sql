-- Emails to staff about their schedule: instant (assigned, changed, cancelled) and a
-- morning summary of tomorrow's jobs. Off by default; each business opts in under Settings.
alter table public.organizations add column staff_notifications_enabled boolean not null default false;
grant update (staff_notifications_enabled) on public.organizations to authenticated;

-- The date each person was last sent a morning summary for, so re-running the daily job never doubles up.
alter table public.staff add column digest_sent_for date;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in ('quote', 'invoice', 'reminder', 'staff'));
