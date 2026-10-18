-- Business logo, shown on invoices, quotes and their PDFs.
alter table public.organizations add column logo_path text;

-- Public bucket: logos appear on documents sent to clients, so they are not secret. Uploads and
-- deletes only happen server-side with the service role (no write policies for browsers).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
