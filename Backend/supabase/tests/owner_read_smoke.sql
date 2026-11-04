-- Short grading demo: owner can read Luna, but cannot read Max.
-- Run as postgres against the seeded LOCAL database. Leaves no changes.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if not exists (select 1 from public.pets where name = 'Luna') then
    raise exception 'FAIL: owner cannot read own pet';
  end if;
  if exists (select 1 from public.pets where name = 'Max') then
    raise exception 'FAIL: owner can read another owner''s pet';
  end if;
end;
$$;
rollback;
