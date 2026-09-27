-- Google OAuth sign-in: a Google identity carries no app_role/org_id
-- metadata (that only exists for the invite and email/password self-signup
-- paths), so the trigger can no longer treat a missing org_id as fatal —
-- doing so would roll back the whole auth.users insert and break Google
-- sign-in outright. Instead: skip profile creation when org_id is absent,
-- and let /auth/callback provision (new business) or reject (unrecognized
-- email) the account afterward, using the service-role client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'app_role';
  meta_staff_id uuid := nullif(new.raw_user_meta_data ->> 'staff_id', '')::uuid;
  meta_org_id uuid := nullif(new.raw_user_meta_data ->> 'org_id', '')::uuid;
begin
  if meta_org_id is not null then
    insert into public.profiles (user_id, role, staff_id, org_id)
    values (new.id, coalesce(meta_role, 'staff'), meta_staff_id, meta_org_id)
    on conflict (user_id) do nothing;

    if meta_staff_id is not null then
      update public.staff set user_id = new.id where id = meta_staff_id;
    end if;
  end if;

  return new;
end;
$$;
