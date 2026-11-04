-- Run as postgres after migrations + seed. Every mutation rolls back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"staff"}}', true);

do $$
declare
  changed integer;
  booking uuid := '90000000-0000-4000-8000-000000000001';
  start_time timestamptz := ((now() at time zone 'Asia/Manila')::date + 30 + time '09:00') at time zone 'Asia/Manila';
begin
  if public.current_role() is distinct from 'owner'::public.app_role then
    raise exception 'FAIL: editable JWT metadata must not grant a clinic role';
  end if;
  if (select count(*) from public.owners) <> 1 or (select count(*) from public.pets) <> 1 then
    raise exception 'FAIL: Janicah should see only her owner row and Luna';
  end if;
  if not exists (select 1 from public.pets where id = '30000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: the positive control must show Luna';
  end if;
  if exists (select 1 from public.pets where id = '30000000-0000-4000-8000-000000000002') then
    raise exception 'FAIL: owner can read another owner''s pet (Max)';
  end if;
  if exists (select 1 from public.visits where pet_id <> '30000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.vaccinations where pet_id <> '30000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.appointments where pet_id <> '30000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.vaccines_due where pet_id <> '30000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: another patient leaked through a care table or view';
  end if;
  if (select count(*) from public.vaccinations) <> 2
    or (select count(*) from public.visits) <> 1
    or (select count(*) from public.vaccines_due) <> 1 then
    raise exception 'FAIL: owner must still see her own care history and due vaccine';
  end if;
  if (select count(*) from public.list_veterinarians()) <> 2 then
    raise exception 'FAIL: owner booking needs the limited vet directory';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL: directory must not grant access to private vet profiles';
  end if;
  if exists (select 1 from public.reminders) then
    raise exception 'FAIL: delivery logs are clinic-only';
  end if;

  update public.profiles set role = 'staff' where id = '10000000-0000-4000-8000-000000000004';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: owner escalated their role'; end if;
  update public.pets set name = 'Changed' where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: owner changed a pet'; end if;
  update public.visits set diagnosis = 'Changed' where pet_id = '30000000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: owner changed a medical record'; end if;
  update public.vaccinations set given_on = given_on - 1 where pet_id = '30000000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: owner changed a vaccination'; end if;

  begin
    insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason)
    values ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', start_time, start_time + interval '30 minutes', 'Not my pet');
    raise exception 'FAIL: owner booked another owner''s pet';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason, status)
    values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', start_time, start_time + interval '30 minutes', 'Self-confirmation attempt', 'confirmed');
    raise exception 'FAIL: owner self-confirmed a booking';
  exception when insufficient_privilege then null;
  end;

  insert into public.appointments (id, pet_id, vet_id, starts_at, ends_at, reason)
  values (booking, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', start_time, start_time + interval '30 minutes', 'Owner-booked wellness visit');
  begin
    update public.appointments set starts_at = start_time + interval '5 minutes', status = 'cancelled' where id = booking;
    raise exception 'FAIL: owner changed the time while cancelling';
  exception when insufficient_privilege then null;
  end;
  update public.appointments set status = 'cancelled' where id = booking;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'FAIL: cancellation of own future booking should work'; end if;
  delete from public.appointments where id = booking;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: owner deleted an appointment'; end if;
end;
$$;
rollback;
