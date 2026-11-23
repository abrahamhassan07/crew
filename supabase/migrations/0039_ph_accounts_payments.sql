-- PH Accounts integration, step 6c: payments sync both ways.
-- Each payment's twin in PH Accounts, and 'phaccounts' as a source for payments first recorded there.
alter table public.payments add column ph_payment_id uuid;

alter table public.payments drop constraint if exists payments_source_check;
alter table public.payments add constraint payments_source_check check (source in ('app', 'xero', 'phaccounts'));

-- One PH Accounts payment can pay several invoices: one row here per invoice it paid.
create unique index payments_ph_payment_invoice_key on public.payments (invoice_id, ph_payment_id) where ph_payment_id is not null;
