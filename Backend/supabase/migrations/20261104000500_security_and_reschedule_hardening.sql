-- Separate account administration from clinic care access.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'owners', 'pets', 'vaccine_types', 'vaccinations', 'visits', 'appointments', 'reminders']
  loop
    execute format('drop policy if exists clinic_full_access on public.%I', table_name);
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'owners', 'pets', 'vaccine_types', 'vaccinations', 'visits', 'appointments', 'reminders']
  loop
    execute format(
      'create policy staff_full_access on public.%I for all to authenticated using ((select app_private.current_role()) = ''staff'') with check ((select app_private.current_role()) = ''staff'')',
      table_name
    );
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['pets', 'vaccine_types', 'vaccinations', 'visits', 'appointments', 'reminders']
  loop
    execute format(
      'create policy vet_care_access on public.%I for all to authenticated using ((select app_private.current_role()) = ''vet'') with check ((select app_private.current_role()) = ''vet'')',
      table_name
    );
  end loop;
end;
$$;

create policy vet_profiles_read on public.profiles
  for select to authenticated
  using ((select app_private.current_role()) = 'vet');

create policy vet_owners_read on public.owners
  for select to authenticated
  using ((select app_private.current_role()) = 'vet');

-- Private pet photos require signed URLs even for staff and vets.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute 'update storage.buckets set public = false where id = ''pet-photos''';
  end if;
end;
$$;

alter table public.reminders
  add column if not exists provider_message_id text,
  add column if not exists retry_count integer not null default 0;

create or replace function public.reschedule_appointment(
  p_old_appointment_id uuid,
  p_pet_id uuid,
  p_vet_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  replacement_id uuid;
  old_row public.appointments%rowtype;
begin
  if (select app_private.current_role()) not in ('staff', 'vet') then
    raise exception using errcode = '42501', message = 'Only clinic staff or vets can reschedule appointments.';
  end if;

  select *
  into old_row
  from public.appointments
  where id = p_old_appointment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The original appointment was not found.';
  end if;

  if old_row.status in ('cancelled', 'completed', 'rescheduled') then
    raise exception using errcode = '23514', message = 'This appointment cannot be rescheduled.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception using errcode = '23514', message = 'The appointment end time must be after the start time.';
  end if;

  insert into public.appointments (
    pet_id, vet_id, starts_at, ends_at, reason, status
  )
  values (
    p_pet_id, p_vet_id, p_starts_at, p_ends_at, p_reason, 'confirmed'
  )
  returning id into replacement_id;

  update public.appointments
  set status = 'rescheduled'
  where id = p_old_appointment_id;

  return replacement_id;
end;
$$;

revoke all on function public.reschedule_appointment(uuid, uuid, uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.reschedule_appointment(uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated;
