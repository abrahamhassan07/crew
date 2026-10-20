-- Xero payments sync: payments recorded here are sent to Xero, and payments recorded in Xero come back here.

-- Which scopes the business approved (older connections lack accounting.payments and must reconnect),
-- and which Xero bank account payments recorded here are paid into (null = don't send payments).
alter table public.xero_connections
  add column scopes text[] not null default '{}',
  add column bank_account_id text,
  add column bank_account_name text;

-- Each payment's twin in Xero, and where it was first recorded ('app' or 'xero').
alter table public.payments
  add column xero_payment_id text,
  add column source text not null default 'app' check (source in ('app', 'xero'));

create unique index payments_xero_payment_id_key on public.payments (org_id, xero_payment_id) where xero_payment_id is not null;
