-- Job numbers (J-1000, J-1001, ...) mirroring quotes/invoices/requests, and
-- allow a job to exist without a scheduled date/time ("Unscheduled"), for
-- parity with the Claude Design Jobs list.

alter table public.jobs add column num text;

do $$
declare
  r record;
  n int := 1000;
begin
  for r in select id from public.jobs order by created_at loop
    update public.jobs set num = 'J-' || n where id = r.id;
    n := n + 1;
  end loop;
end $$;

alter table public.jobs alter column num set not null;
alter table public.jobs add constraint jobs_num_unique unique (num);

alter table public.jobs alter column job_date drop not null;
alter table public.jobs alter column start_time drop not null;

-- Re-declare the staff update-scope guard to also protect the new column.
create or replace function public.enforce_job_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.client_name is distinct from old.client_name
     or new.address is distinct from old.address
     or new.job_type is distinct from old.job_type
     or new.job_date is distinct from old.job_date
     or new.start_time is distinct from old.start_time
     or new.duration_minutes is distinct from old.duration_minutes
     or new.assigned_staff_id is distinct from old.assigned_staff_id
     or new.price is distinct from old.price
     or new.notes is distinct from old.notes
     or new.recurrence is distinct from old.recurrence
     or new.series_id is distinct from old.series_id
     or new.num is distinct from old.num
  then
    raise exception 'Staff may only update job status';
  end if;

  return new;
end;
$$;
