-- Day-before reminder emails to customers.
-- Off by default; each business opts in under Settings.
alter table public.organizations
  add column reminders_enabled boolean not null default false,
  add column reminder_email_subject text,
  add column reminder_email_body text;

grant update (reminders_enabled, reminder_email_subject, reminder_email_body) on public.organizations to authenticated;

-- The date a reminder was last sent for. Comparing it with job_date means a job that is
-- rescheduled gets a fresh reminder for its new date, and a job is never reminded twice.
alter table public.jobs add column reminder_sent_for date;

-- Reminders are sent by the scheduled job, not by a signed-in user, so user_id is optional.
alter table public.email_log alter column user_id drop not null;
alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in ('quote', 'invoice', 'reminder'));
