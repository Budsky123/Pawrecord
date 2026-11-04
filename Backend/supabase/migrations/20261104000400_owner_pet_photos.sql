create policy owner_pet_photo_update on public.pets for update to authenticated
  using (owner_id in (select id from public.owners where profile_id = (select auth.uid())))
  with check (owner_id in (select id from public.owners where profile_id = (select auth.uid())));

create function app_private.guard_owner_pet_photo_update()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if app_private.current_role() = 'owner'
    and (to_jsonb(new) - 'photo_url' - 'updated_at') is distinct from
        (to_jsonb(old) - 'photo_url' - 'updated_at') then
    raise exception using errcode = '42501', message = 'Owners may only update their pets'' profile photo.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_owner_pet_photo_update() from public, anon, authenticated, service_role;

create trigger pets_owner_photo_guard
before update on public.pets
for each row execute function app_private.guard_owner_pet_photo_update();

do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (id, name, public)
      values ('pet-photos', 'pet-photos', true)
      on conflict (id) do update set public = true
    $storage$;

    execute $storage$
      create policy pet_photos_staff_access on storage.objects
      for all to authenticated
      using (bucket_id = 'pet-photos' and (select app_private.current_role()) in ('staff', 'vet'))
      with check (bucket_id = 'pet-photos' and (select app_private.current_role()) in ('staff', 'vet'))
    $storage$;

    execute $storage$
      create policy pet_photos_owner_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'pet-photos'
        and (storage.foldername(name))[1] in (
          select id::text from public.owners where profile_id = (select auth.uid())
        )
      )
    $storage$;

    execute $storage$
      create policy pet_photos_owner_write on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'pet-photos'
        and (storage.foldername(name))[1] in (
          select id::text from public.owners where profile_id = (select auth.uid())
        )
      )
    $storage$;
  end if;
end;
$$;
