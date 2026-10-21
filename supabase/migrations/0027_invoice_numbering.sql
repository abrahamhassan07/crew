-- Invoice numbering that can match what a business already has in Xero, and a free-text invoice reference.
--  invoice_prefix: text before the number (default 'INV-').
--  invoice_next_number: the number the next invoice gets (null = carry on from the highest existing, as before).
--  invoice_number_digits: minimum digits, so 351 can be written 0351.
--  invoice_reference_template: how a new invoice's Reference is pre-filled; {job_number}, {client_name} and
--    {service_address} are filled in, and it's left blank if one of them is empty. The user can edit it per invoice.
alter table public.organizations
  add column invoice_prefix text not null default 'INV-',
  add column invoice_next_number integer check (invoice_next_number is null or invoice_next_number between 1 and 99999999),
  add column invoice_number_digits smallint not null default 1 check (invoice_number_digits between 1 and 8),
  add column invoice_reference_template text not null default 'Job {job_number}';

grant update (invoice_prefix, invoice_next_number, invoice_number_digits, invoice_reference_template) on public.organizations to authenticated;

-- The reference on each invoice (sent to Xero as its Reference). Null on invoices made before this existed.
alter table public.invoices add column reference text;
