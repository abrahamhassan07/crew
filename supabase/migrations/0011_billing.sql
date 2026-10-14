-- Billing state per organisation, written only by the Stripe webhook
-- (service role). Existing organisations are marked billing_exempt so turning
-- billing on later never locks out the original businesses; new signups get a
-- 14-day trial.
alter table public.organizations
  add column plan text,
  add column team_size text,
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column current_period_end timestamptz,
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column billing_exempt boolean not null default false;

update public.organizations set billing_exempt = true;

-- The organizations_update_admin policy lets an admin update their own org
-- row; without this, they could also write their own billing columns
-- (e.g. mark themselves paid). Restrict browser-side updates to profile fields.
revoke update on public.organizations from authenticated;
grant update (name, email, phone, address, abn) on public.organizations to authenticated;
