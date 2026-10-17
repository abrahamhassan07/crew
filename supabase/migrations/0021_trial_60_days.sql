-- Longer free trial: new businesses get 60 days instead of 14.
-- Only the default changes; businesses that already exist keep their current trial end date
-- (extend one from the platform owner's Businesses page if needed).
alter table public.organizations alter column trial_ends_at set default (now() + interval '60 days');
