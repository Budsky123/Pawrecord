begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  start_time timestamptz := ((now() at time zone 'Asia/Manila')::date + 30 + time '09:00') at time zone 'Asia/Manila';
  first_booking uuid := '90000000-0000-4000-8000-000000000002';
begin
  insert into public.appointments (id, pet_id, vet_id, starts_at, ends_at, reason, status)
  values (first_booking, '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', start_time, start_time + interval '30 minutes', 'Conflict baseline', 'confirmed');
  begin
    insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason)
    values ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', start_time + interval '15 minutes', start_time + interval '45 minutes', 'Overlapping vet');
    raise exception 'FAIL: same vet was double-booked';
  exception when exclusion_violation then null;
  end;
  -- An adjacent appointment and a simultaneous appointment for another vet work.
  insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason) values
    ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', start_time + interval '30 minutes', start_time + interval '1 hour', 'Adjacent slot'),
    ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', start_time, start_time + interval '30 minutes', 'Different vet');
  update public.appointments set status = 'cancelled' where id = first_booking;
  insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason)
  values ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', start_time, start_time + interval '30 minutes', 'Reused cancelled slot');
  begin
    insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason)
    values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', start_time, start_time + interval '30 minutes', 'Owner masquerading as vet');
    raise exception 'FAIL: non-vet was assigned as clinician';
  exception when check_violation then null;
  end;
  begin
    insert into public.appointments (pet_id, vet_id, starts_at, ends_at, reason)
    values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', start_time + interval '2 hours', start_time + interval '2 hours', 'Zero duration');
    raise exception 'FAIL: zero-duration appointment accepted';
  exception when check_violation then null;
  end;
end;
$$;
rollback;
