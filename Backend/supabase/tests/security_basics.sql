begin;
do $$
declare protected_table text;
begin
  foreach protected_table in array array['profiles', 'owners', 'pets', 'vaccine_types', 'vaccinations', 'visits', 'appointments', 'reminders'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = protected_table and c.relrowsecurity) then
      raise exception 'FAIL: missing RLS on %', protected_table;
    end if;
  end loop;
  if not exists (select 1 from pg_class where oid = 'public.vaccines_due'::regclass and reloptions @> array['security_invoker=true']) then
    raise exception 'FAIL: due-vaccine view must enforce caller RLS';
  end if;
end;
$$;

-- A signup that requests staff privileges must still become an owner.
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values ('90000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'unlinked@pawrecord.test', '{"full_name":"Unlinked test","role":"staff"}', '{}');
do $$
begin
  if (select role from public.profiles where id = '90000000-0000-4000-8000-000000000004') <> 'owner' then
    raise exception 'FAIL: signup metadata escalated privileges';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.pets) or exists (select 1 from public.owners) then
    raise exception 'FAIL: an unlinked account inherited another owner''s records';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.current_role() <> 'staff' or (select count(*) from public.pets) <> 4 then
    raise exception 'FAIL: clinic manager must see all four seeded patients';
  end if;
  update public.pets set breed = 'Demo edited breed' where id = '30000000-0000-4000-8000-000000000001';
  if not found then raise exception 'FAIL: staff write was denied'; end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.pets;
    raise exception 'FAIL: unauthenticated patient access allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.current_role();
    raise exception 'FAIL: unauthenticated role RPC allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
