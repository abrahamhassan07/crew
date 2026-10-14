-- Default payment instructions (bank/PayID details) copied onto each new
-- invoice. Free text so it works for EFT, PayID, cheque, a payment link, etc.
alter table public.organizations add column payment_details text;

-- Column-level grant (see 0011): admins may edit this, but not billing columns.
grant update (payment_details) on public.organizations to authenticated;
