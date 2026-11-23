-- PH Accounts integration, step 6b: sent invoices are created in the connected PH Accounts business.
-- Where each invoice and client ended up in PH Accounts, what was last sent (to spot edits), and why a sync failed.
alter table public.invoices
  add column ph_invoice_id uuid,
  add column ph_synced_at timestamptz,
  add column ph_sync_hash text,
  add column ph_error text;

alter table public.clients add column ph_customer_id uuid;
