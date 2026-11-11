-- Adds "every 3 weeks" and "every 4 weeks" to the repeat choices on a job. Existing rows are unaffected.
alter table public.jobs drop constraint if exists jobs_recurrence_check;
alter table public.jobs add constraint jobs_recurrence_check check (recurrence in ('none', 'weekly', 'fortnightly', 'every3weeks', 'every4weeks', 'monthly'));
