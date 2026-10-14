-- RLS stops a tenant reading or writing another tenant's rows, but foreign-key
-- checks bypass RLS, so a row in org A could still *reference* an id that
-- belongs to org B (found by scripts/test-tenant-isolation.mjs). That leaks
-- id existence and lets B's deletes cascade into A's data. This trigger
-- rejects any reference whose parent row lives in a different organisation.
create or replace function public.enforce_same_org_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i int := 0;
  col text;
  parent text;
  ref uuid;
  parent_org uuid;
begin
  while i < tg_nargs loop
    col := tg_argv[i];
    parent := tg_argv[i + 1];
    i := i + 2;
    ref := nullif(to_jsonb(new) ->> col, '')::uuid;
    if ref is null then
      continue;
    end if;
    execute format('select org_id from public.%I where id = $1', parent) into parent_org using ref;
    if parent_org is not null and parent_org <> new.org_id then
      raise exception 'Cross-organisation reference rejected (%.% -> %)', tg_table_name, col, parent;
    end if;
  end loop;
  return new;
end;
$$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('crews',          array['lead_staff_id','staff']),
      ('staff',          array['crew_id','crews']),
      ('profiles',       array['staff_id','staff']),
      ('properties',     array['client_id','clients']),
      ('client_contacts',array['client_id','clients']),
      ('client_notes',   array['client_id','clients','staff_id','staff']),
      ('services',       array['default_crew_id','crews']),
      ('requests',       array['client_id','clients','service_id','services']),
      ('quotes',         array['client_id','clients','property_id','properties','request_id','requests','job_id','jobs']),
      ('quote_items',    array['quote_id','quotes','service_id','services']),
      ('invoices',       array['client_id','clients','property_id','properties','job_id','jobs']),
      ('invoice_items',  array['invoice_id','invoices','service_id','services']),
      ('payments',       array['invoice_id','invoices']),
      ('equipment',      array['crew_id','crews']),
      ('jobs',           array['assigned_staff_id','staff','client_id','clients','property_id','properties','crew_id','crews','service_id','services','quote_id','quotes']),
      ('job_photos',     array['job_id','jobs'])
    ) as v(tbl, args)
  loop
    execute format('drop trigger if exists enforce_same_org_refs on public.%I', spec.tbl);
    execute format(
      'create trigger enforce_same_org_refs before insert or update on public.%I for each row execute function public.enforce_same_org_refs(%s)',
      spec.tbl,
      (select string_agg(quote_literal(a), ', ') from unnest(spec.args) as a)
    );
  end loop;
end $$;
