-- Optional notes on a quote or invoice (e.g. what was done, access details), shown on screen and in the PDF.
alter table public.invoices add column service_notes text not null default '';
alter table public.quotes add column service_notes text not null default '';
