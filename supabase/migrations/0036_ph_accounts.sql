-- PH Accounts integration ("Connect to PH Accounts"), step 6a: the connection itself.
-- One business connects one PH Accounts business (OAuth 2.0 + PKCE). Like xero_connections, tokens are stored
-- encrypted and this table is only ever read or written by the server (service role): RLS is on with no
-- policies, and access is revoked from the browser-facing roles.
create table public.ph_accounts_connections (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  -- The PH Accounts business this connection covers (from the token response).
  ph_org_id uuid not null,
  ph_org_name text not null default '',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  -- PH Accounts refresh tokens rotate and reusing an old one disconnects the app, so only one request may
  -- refresh at a time: it claims the refresh by setting this a few seconds ahead (see freshAccessToken).
  refreshing_until timestamptz,
  scopes text[] not null default '{}',
  -- The business ticked "can send finished invoices" on PH Accounts' consent screen. False = drafts only.
  can_issue_invoices boolean not null default false,
  -- Where invoice lines are booked, the GST tax code for taxed lines, and where payments are paid into
  -- (PH Accounts account / tax code ids; names kept for display). Null = not chosen yet.
  revenue_account_id uuid,
  revenue_account_name text,
  gst_tax_code_id uuid,
  gst_tax_code_name text,
  bank_account_id uuid,
  bank_account_name text,
  auto_sync boolean not null default true,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ph_accounts_connections enable row level security;
revoke all on public.ph_accounts_connections from anon, authenticated;

create trigger ph_accounts_connections_set_updated_at
before update on public.ph_accounts_connections
for each row execute function public.set_updated_at();
