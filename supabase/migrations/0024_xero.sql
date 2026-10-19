-- Xero integration: each business connects its own Xero organisation; sent invoices are copied into it.
-- Tokens are stored encrypted and this table is only ever read or written by the server (service role):
-- RLS is on with no policies, and access is revoked from the browser-facing roles.
create table public.xero_connections (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  connection_id text not null,
  tenant_id text not null,
  tenant_name text not null default '',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  sales_account_code text not null default '200',
  auto_sync boolean not null default true,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.xero_connections enable row level security;
revoke all on public.xero_connections from anon, authenticated;

create trigger xero_connections_set_updated_at
before update on public.xero_connections
for each row execute function public.set_updated_at();

-- Where each invoice and client ended up in Xero, and why a sync failed (shown on the invoice).
alter table public.invoices
  add column xero_invoice_id text,
  add column xero_synced_at timestamptz,
  add column xero_error text;

alter table public.clients add column xero_contact_id text;
