begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  new_dose uuid := '90000000-0000-4000-8000-000000000003';
begin
  insert into public.vaccinations (id, pet_id, vaccine_type_id, given_on, next_due_on, administered_by)
  values (new_dose, '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', today - 1, today + 999, '10000000-0000-4000-8000-000000000002');
  if (select next_due_on from public.vaccinations where id = new_dose) <> today + 364 then
    raise exception 'FAIL: caller override beat the vaccine date trigger';
  end if;
  if exists (select 1 from public.vaccines_due where pet_id = '30000000-0000-4000-8000-000000000004' and vaccine_type_id = '40000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: superseded historical dose still appears overdue';
  end if;
  update public.vaccinations set given_on = today - 2 where id = new_dose;
  if (select next_due_on from public.vaccinations where id = new_dose) <> today + 363 then
    raise exception 'FAIL: editing administration date did not recalculate due date';
  end if;
  update public.vaccine_types set interval_days = 400 where id = '40000000-0000-4000-8000-000000000001';
  if (select next_due_on from public.vaccinations where id = new_dose) <> today + 398 then
    raise exception 'FAIL: catalog interval edit did not recalculate existing doses';
  end if;
  begin
    insert into public.vaccinations (pet_id, vaccine_type_id, given_on, administered_by)
    values ('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', today + 1, '10000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: future dose recorded as administered';
  exception when check_violation then null;
  end;
  begin
    insert into public.reminders (pet_id, type, sent_to, vaccination_id, due_on)
    select pet_id, type, sent_to, vaccination_id, due_on from public.reminders where id = '70000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: duplicate delivery claim accepted';
  exception when unique_violation then null;
  end;
end;
$$;
rollback;
