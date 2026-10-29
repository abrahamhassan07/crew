-- When an invoice was first sent to a client. Plans cap how many invoices a business can send per calendar month
-- (Free 20, Solo 100, Team 200, Business 300), counted from this date: resends and drafts don't count.
alter table public.invoices add column first_sent_at timestamptz;

-- Existing invoices that have already gone out count from when they were created (the closest date we have).
update public.invoices set first_sent_at = created_at where status <> 'Draft' and first_sent_at is null;

create index invoices_org_first_sent_idx on public.invoices (org_id, first_sent_at) where first_sent_at is not null;
