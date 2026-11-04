-- Helpers live outside the exposed API schema. The one privileged role lookup
-- reads only the caller's profile to avoid an RLS recursion on profiles itself.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create function app_private.current_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where (select auth.uid()) is not null and p.id = (select auth.uid());
$$;
revoke all on function app_private.current_role() from public, anon, authenticated, service_role;
grant execute on function app_private.current_role() to authenticated, service_role;

-- Safe public RPC wrapper; its body has no elevated privileges.
create function public.current_role()
returns public.app_role language sql stable security invoker set search_path = ''
as $$ select app_private.current_role(); $$;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated, service_role;

-- Signup creates an unlinked owner profile. Never trust a role supplied in
-- user_metadata, and never auto-link an owner by a user-editable email/name.
-- Only a staff user can link owners.profile_id or promote a clinic account.
create function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 120), ''), 'Pet owner'),
    'owner'
  );
  return new;
end;
$$;
-- This definer is trigger-only: GoTrue has no end-user JWT during signup.
revoke all on function app_private.handle_new_user() from public, anon, authenticated, service_role;
create trigger pawrecord_on_auth_user_created
  after insert on auth.users for each row execute function app_private.handle_new_user();

create function app_private.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function app_private.touch_updated_at() from public, anon, authenticated, service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'owners', 'pets', 'vaccine_types', 'vaccinations', 'visits', 'appointments', 'reminders']
  loop
    execute format('create trigger zz_touch_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()', table_name);
    execute format('create policy clinic_full_access on public.%I for all to authenticated using ((select app_private.current_role()) in (''staff'', ''vet'')) with check ((select app_private.current_role()) in (''staff'', ''vet''))', table_name);
  end loop;
end;
$$;

create policy profile_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy owner_self_read on public.owners for select to authenticated
  using (profile_id = (select auth.uid()) and (select app_private.current_role()) = 'owner');
create policy owner_pets_read on public.pets for select to authenticated
  using (owner_id in (select id from public.owners where profile_id = (select auth.uid())));
create policy vaccine_catalog_read on public.vaccine_types for select to authenticated
  using ((select app_private.current_role()) = 'owner');
create policy owner_vaccinations_read on public.vaccinations for select to authenticated
  using (pet_id in (select id from public.pets));
create policy owner_visits_read on public.visits for select to authenticated
  using (deleted_at is null and pet_id in (select id from public.pets));
create policy owner_appointments_read on public.appointments for select to authenticated
  using (pet_id in (select id from public.pets));
create policy owner_appointments_book on public.appointments for insert to authenticated
  with check (
    (select app_private.current_role()) = 'owner'
    and pet_id in (select id from public.pets)
    and status = 'pending' and starts_at > now()
  );
create policy owner_appointments_cancel on public.appointments for update to authenticated
  using (
    (select app_private.current_role()) = 'owner'
    and pet_id in (select id from public.pets)
    and status in ('pending', 'confirmed') and starts_at > now()
  )
  with check (
    (select app_private.current_role()) = 'owner'
    and pet_id in (select id from public.pets) and status = 'cancelled'
  );

create function app_private.guard_owner_appointment_update()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  -- RLS checks ownership; this checks the OLD/NEW transition. An owner cannot
  -- change time, pet, vet, reason, or any other data while also cancelling.
  if app_private.current_role() = 'owner' then
    if old.status not in ('pending', 'confirmed') or old.starts_at <= now()
      or new.status <> 'cancelled'
      or (to_jsonb(new) - 'status' - 'updated_at') is distinct from
         (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception using errcode = '42501', message = 'Owners may only cancel their own upcoming appointments.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_owner_appointment_update() from public, anon, authenticated, service_role;
create trigger aa_guard_owner_appointment_update before update on public.appointments
  for each row execute function app_private.guard_owner_appointment_update();

-- Owners cannot read other profiles, so vet validation is an internal trigger
-- with tightly bounded privileges. It cannot be called as an API RPC.
create function app_private.validate_vet_reference()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and app_private.current_role() is null then
    raise exception using errcode = '42501', message = 'A clinic profile is required.';
  end if;
  if not exists (select 1 from public.profiles where id = new.vet_id and role = 'vet') then
    raise exception using errcode = '23514', message = 'The selected clinician must have the vet role.';
  end if;
  return new;
end;
$$;
revoke all on function app_private.validate_vet_reference() from public, anon, authenticated, service_role;
create trigger bb_validate_appointment_vet before insert or update of vet_id on public.appointments
  for each row execute function app_private.validate_vet_reference();
create trigger validate_visit_vet before insert or update of vet_id on public.visits
  for each row execute function app_private.validate_vet_reference();

-- Owner booking needs a vet picker, but no access to vets' phone numbers.
create function app_private.veterinarian_directory()
returns table (id uuid, full_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name from public.profiles p
  where (select auth.uid()) is not null
    and (select app_private.current_role()) is not null and p.role = 'vet'
  order by p.full_name;
$$;
revoke all on function app_private.veterinarian_directory() from public, anon, authenticated, service_role;
grant execute on function app_private.veterinarian_directory() to authenticated, service_role;
create function public.list_veterinarians()
returns table (id uuid, full_name text)
language sql stable security invoker set search_path = ''
as $$ select * from app_private.veterinarian_directory(); $$;
revoke all on function public.list_veterinarians() from public, anon;
grant execute on function public.list_veterinarians() to authenticated, service_role;

create function app_private.calculate_vaccination_due_date()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare repeat_days integer;
begin
  if new.given_on > (now() at time zone 'Asia/Manila')::date then
    raise exception using errcode = '23514', message = 'Record an administered vaccine; use an appointment for a future dose.';
  end if;
  select interval_days into repeat_days from public.vaccine_types where id = new.vaccine_type_id;
  if repeat_days is null then
    raise exception using errcode = '23503', message = 'Unknown vaccine type.';
  end if;
  new.next_due_on := new.given_on + repeat_days;
  return new;
end;
$$;
revoke all on function app_private.calculate_vaccination_due_date() from public, anon, authenticated, service_role;
create trigger calculate_vaccination_due_date before insert or update on public.vaccinations
  for each row execute function app_private.calculate_vaccination_due_date();

-- Updating the catalog also recalculates existing doses, keeping the invariant
-- true after an interval edit rather than only when a dose itself changes.
create function app_private.refresh_vaccine_interval()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.interval_days is distinct from old.interval_days then
    update public.vaccinations set next_due_on = given_on + new.interval_days
    where vaccine_type_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function app_private.refresh_vaccine_interval() from public, anon, authenticated, service_role;
create trigger refresh_vaccine_interval after update of interval_days on public.vaccine_types
  for each row execute function app_private.refresh_vaccine_interval();

-- A historical dose must stop appearing overdue once a later dose supersedes it.
-- security_invoker is essential: otherwise the view owner's privileges bypass RLS.
create view public.vaccines_due with (security_invoker = true) as
with latest_doses as (
  select distinct on (pet_id, vaccine_type_id) * from public.vaccinations
  order by pet_id, vaccine_type_id, given_on desc, created_at desc, id desc
)
select v.id as vaccination_id, v.pet_id, p.owner_id, p.name as pet_name,
  v.vaccine_type_id, t.name as vaccine_name, v.given_on, v.next_due_on,
  v.next_due_on - (now() at time zone 'Asia/Manila')::date as days_until_due,
  case when v.next_due_on < (now() at time zone 'Asia/Manila')::date
    then 'overdue' else 'due_soon' end as status
from latest_doses v
join public.pets p on p.id = v.pet_id
join public.vaccine_types t on t.id = v.vaccine_type_id
where v.next_due_on <= (now() at time zone 'Asia/Manila')::date + 14;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.profiles, public.owners, public.pets,
  public.vaccine_types, public.vaccinations, public.visits, public.appointments,
  public.reminders to authenticated;
grant all on public.profiles, public.owners, public.pets, public.vaccine_types,
  public.vaccinations, public.visits, public.appointments, public.reminders to service_role;
revoke all on public.vaccines_due from public, anon;
grant select on public.vaccines_due to authenticated, service_role;

comment on view public.vaccines_due is 'Latest dose per pet and vaccine type; overdue or due in 14 days, using clinic time (Asia/Manila) and caller RLS.';
