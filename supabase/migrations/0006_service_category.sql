-- Service categories (Gardening / Cleaning / Other) so reports can split
-- client and staff hours by category instead of keyword-matching job
-- descriptions. Nullable and additive: existing services stay uncategorised
-- until a business owner reviews and sets one via the Services page.

alter table public.services
  add column category text check (category in ('Gardening', 'Cleaning', 'Other'));

comment on column public.services.category is 'Business-assigned category used for reporting (hours by Gardening/Cleaning/Other). Null = not yet categorised.';
