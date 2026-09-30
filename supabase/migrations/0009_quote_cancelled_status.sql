-- Allow quotes to be cancelled (distinct from Declined, which implies the
-- client responded; Cancelled is for the business withdrawing a quote before
-- that happens, e.g. after "Sent" or even "Approved").
alter table public.quotes drop constraint quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('Draft', 'Sent', 'Approved', 'Declined', 'Expired', 'Cancelled'));
