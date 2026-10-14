-- Per-business wording for the emails that carry a quote or invoice.
-- NULL means "use the built-in default" (see src/lib/emailTemplates.ts).
alter table public.organizations
  add column quote_email_subject text,
  add column quote_email_body text,
  add column invoice_email_subject text,
  add column invoice_email_body text;

-- Column-level grant (see 0011): admins may edit these, but not billing columns.
grant update (quote_email_subject, quote_email_body, invoice_email_subject, invoice_email_body) on public.organizations to authenticated;
