-- Google review requests: after a job is marked complete, email the client a link to review the business.
-- Off by default; each business turns it on in Settings and pastes its own review link.
alter table public.organizations
  add column review_requests_enabled boolean not null default false,
  add column review_link text,
  add column review_email_subject text,
  add column review_email_body text;

grant update (review_requests_enabled, review_link, review_email_subject, review_email_body) on public.organizations to authenticated;

-- When a job's review request went out (never twice for one job), and when a client was last asked
-- (so a weekly client isn't asked every week).
alter table public.jobs add column review_requested_at timestamptz;
alter table public.clients add column review_requested_at timestamptz;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in ('quote', 'invoice', 'reminder', 'staff', 'review'));
