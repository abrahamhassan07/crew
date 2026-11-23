-- GST is rounded per line from 2026-11-23 (each line's amount and GST rounded to the cent, then added up), the way
-- Xero and PH Accounts work, so totals match them to the cent. Documents created before keep the original rule
-- (GST once on the total) so a total that was already sent never changes.
alter table public.invoices
  add column gst_rounding text not null default 'line' check (gst_rounding in ('line', 'invoice'));
alter table public.quotes
  add column gst_rounding text not null default 'line' check (gst_rounding in ('line', 'invoice'));

update public.invoices set gst_rounding = 'invoice';
update public.quotes set gst_rounding = 'invoice';
