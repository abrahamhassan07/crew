-- Staff drafts: an owner can let staff prepare DRAFT quotes and invoices (including by voice). Off by default.
-- Staff never get direct table access to quotes or invoices: their drafts are written by the server after it checks
-- who they are, which clients they may use and that the draft is theirs. Owners and admins approve and send.
alter table public.organizations add column staff_drafts_enabled boolean not null default false;
grant update (staff_drafts_enabled) on public.organizations to authenticated;

-- Pending drafts are found by owners quickly, and a staff member's own drafts by who made them.
create index quotes_pending_idx on public.quotes (org_id) where approval_status = 'pending';
create index invoices_pending_idx on public.invoices (org_id) where approval_status = 'pending';
create index quotes_created_by_idx on public.quotes (org_id, created_by) where created_by is not null;
create index invoices_created_by_idx on public.invoices (org_id, created_by) where created_by is not null;
