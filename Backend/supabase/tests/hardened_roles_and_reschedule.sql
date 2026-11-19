begin;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if public.current_role() <> 'vet' then
    raise exception 'FAIL: vet role fixture was not recognized';
  end if;

  if not exists (select 1 from public.pets) then
    raise exception 'FAIL: vet cannot read clinic pets';
  end if;

  begin
    update public.owners
    set profile_id = '10000000-0000-4000-8000-000000000002'
    where id = '20000000-0000-4000-8000-000000000002';
    if found then
      raise exception 'FAIL: vet changed owner account links';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set role = 'staff'
    where id = '10000000-0000-4000-8000-000000000002';
    if found then
      raise exception 'FAIL: vet changed account role';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare replacement_id uuid;
begin
  replacement_id := public.reschedule_appointment(
    '60000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    ((now() at time zone 'Asia/Manila')::date + 3 + time '11:00') at time zone 'Asia/Manila',
    ((now() at time zone 'Asia/Manila')::date + 3 + time '11:30') at time zone 'Asia/Manila',
    'Rescheduling hardening test'
  );

  if not exists (
    select 1
    from public.appointments
    where id = replacement_id
      and status = 'confirmed'
  ) then
    raise exception 'FAIL: replacement appointment was not created';
  end if;

  if not exists (
    select 1
    from public.appointments
    where id = '60000000-0000-4000-8000-000000000001'
      and status = 'rescheduled'
  ) then
    raise exception 'FAIL: original appointment was not marked rescheduled';
  end if;
end;
$$;

rollback;
