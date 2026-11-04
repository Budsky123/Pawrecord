-- LOCAL DEMO ONLY. Supabase CLI runs this after migrations on a reset.
-- All names/contact details/passwords here are fictional. No emails are sent.
-- Production users must be created through Auth Admin, not inserts into auth.*.
begin;

-- Include both auth.users and auth.identities so these are usable email logins.
-- Empty token strings avoid nullable-token incompatibilities in GoTrue.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, email_change_confirm_status
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, demo.id::uuid,
  'authenticated', 'authenticated', demo.email,
  extensions.crypt('PawRecordDemo!2026', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', demo.full_name), now(), now(),
  '', '', '', '', '', '', '', '', 0
from (values
  ('10000000-0000-4000-8000-000000000001', 'manager@pawrecord.test', 'Angel Mae'),
  ('10000000-0000-4000-8000-000000000002', 'sunny@pawrecord.test', 'Dr. Sunny'),
  ('10000000-0000-4000-8000-000000000003', 'cj@pawrecord.test', 'Dr. CJ'),
  ('10000000-0000-4000-8000-000000000004', 'janicah@pawrecord.test', 'Janicah Grace')
) as demo(id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004'
)
on conflict (provider_id, provider) do nothing;

-- Promotion is a trusted SQL operation; signup metadata never sets these roles.
update public.profiles set role = 'staff' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'vet' where id in (
  '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003'
);

insert into public.owners (id, profile_id, full_name, email, phone) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'Janicah Grace', 'janicah@pawrecord.test', '+63 917 000 0101'),
  ('20000000-0000-4000-8000-000000000002', null, 'Arah Marie', 'arah@pawrecord.test', '+63 917 000 0102'),
  ('20000000-0000-4000-8000-000000000003', null, 'Joseph Dean', 'joseph@pawrecord.test', '+63 917 000 0103'),
  ('20000000-0000-4000-8000-000000000004', null, 'Paul Frank', 'paul@pawrecord.test', '+63 917 000 0104')
on conflict (id) do nothing;

insert into public.vaccine_types (id, name, interval_days) values
  ('40000000-0000-4000-8000-000000000001', 'Rabies', 365),
  ('40000000-0000-4000-8000-000000000002', 'DHPP', 365),
  ('40000000-0000-4000-8000-000000000003', 'FVRCP', 365),
  ('40000000-0000-4000-8000-000000000004', 'Bordetella', 180)
on conflict (id) do nothing;

do $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  sunny uuid := '10000000-0000-4000-8000-000000000002';
  cj uuid := '10000000-0000-4000-8000-000000000003';
  luna uuid := '30000000-0000-4000-8000-000000000001';
  max_pet uuid := '30000000-0000-4000-8000-000000000002';
  coco uuid := '30000000-0000-4000-8000-000000000003';
  buddy uuid := '30000000-0000-4000-8000-000000000004';
begin
  insert into public.pets (id, owner_id, name, species, breed, birth_date, sex, health_status, photo_url) values
    (luna, '20000000-0000-4000-8000-000000000001', 'Luna', 'Cat', 'Persian', (today - interval '2 years 4 months')::date, 'female', 'healthy', '/images/luna.png'),
    (max_pet, '20000000-0000-4000-8000-000000000002', 'Max', 'Dog', 'Dachshund', (today - interval '3 years 5 months')::date, 'male', 'follow_up', null),
    (coco, '20000000-0000-4000-8000-000000000003', 'Coco', 'Cat', 'Persian', (today - interval '2 years 2 months')::date, 'female', 'healthy', null),
    (buddy, '20000000-0000-4000-8000-000000000004', 'Buddy', 'Dog', 'Mixed breed', (today - interval '7 years 3 months')::date, 'male', 'medication', null)
  on conflict (id) do nothing;

  insert into public.visits (id, pet_id, vet_id, visit_date, category, reason, diagnosis, treatment, notes) values
    ('50000000-0000-4000-8000-000000000001', luna, sunny, (today - 14 + time '09:00') at time zone 'Asia/Manila', 'wellness', 'Annual wellness exam', 'Healthy on routine examination', 'Routine preventive care discussed', 'Demo record. Rabies booster is due soon.'),
    ('50000000-0000-4000-8000-000000000002', max_pet, cj, (today - 19 + time '10:30') at time zone 'Asia/Manila', 'dental', 'Dental cleaning', 'Plaque buildup', 'Dental cleaning completed', 'Follow-up booked to check recovery.'),
    ('50000000-0000-4000-8000-000000000003', coco, sunny, (today - 28 + time '12:15') at time zone 'Asia/Manila', 'other', 'Skin irritation', 'Mild skin irritation', 'Gentle skin care advised', 'Monitor and return if symptoms persist.'),
    ('50000000-0000-4000-8000-000000000004', buddy, cj, (today - 35 + time '14:00') at time zone 'Asia/Manila', 'other', 'Arthritis follow-up', 'Stable chronic joint discomfort', 'Existing care plan reviewed', 'Fictional treatment record; no dosing instructions.')
  on conflict (id) do nothing;

  -- Omit next_due_on: the database trigger computes every value.
  insert into public.vaccinations (id, pet_id, vaccine_type_id, given_on, administered_by) values
    ('80000000-0000-4000-8000-000000000001', luna, '40000000-0000-4000-8000-000000000001', today - 363, sunny),
    ('80000000-0000-4000-8000-000000000002', luna, '40000000-0000-4000-8000-000000000003', today - 270, sunny),
    ('80000000-0000-4000-8000-000000000003', max_pet, '40000000-0000-4000-8000-000000000004', today - 140, cj),
    ('80000000-0000-4000-8000-000000000004', coco, '40000000-0000-4000-8000-000000000003', today - 359, sunny),
    ('80000000-0000-4000-8000-000000000005', buddy, '40000000-0000-4000-8000-000000000002', today - 245, cj),
    ('80000000-0000-4000-8000-000000000006', buddy, '40000000-0000-4000-8000-000000000001', today - 368, cj)
  on conflict (id) do nothing;

  insert into public.appointments (id, pet_id, vet_id, starts_at, ends_at, reason, status) values
    ('60000000-0000-4000-8000-000000000001', luna, sunny, (today + time '09:00') at time zone 'Asia/Manila', (today + time '09:30') at time zone 'Asia/Manila', 'Annual wellness exam', 'confirmed'),
    ('60000000-0000-4000-8000-000000000002', max_pet, cj, (today + time '10:30') at time zone 'Asia/Manila', (today + time '11:00') at time zone 'Asia/Manila', 'Dental follow-up', 'confirmed'),
    ('60000000-0000-4000-8000-000000000003', coco, sunny, (today + time '12:15') at time zone 'Asia/Manila', (today + time '12:45') at time zone 'Asia/Manila', 'Vaccination', 'confirmed'),
    ('60000000-0000-4000-8000-000000000004', buddy, cj, (today + time '14:00') at time zone 'Asia/Manila', (today + time '14:30') at time zone 'Asia/Manila', 'Check-up', 'confirmed'),
    ('60000000-0000-4000-8000-000000000005', max_pet, cj, (today + 1 + time '09:30') at time zone 'Asia/Manila', (today + 1 + time '10:00') at time zone 'Asia/Manila', 'Dental follow-up', 'pending'),
    ('60000000-0000-4000-8000-000000000006', buddy, sunny, (today + 1 + time '10:00') at time zone 'Asia/Manila', (today + 1 + time '10:30') at time zone 'Asia/Manila', 'Medication review', 'confirmed'),
    ('60000000-0000-4000-8000-000000000007', luna, sunny, (today + 2 + time '10:00') at time zone 'Asia/Manila', (today + 2 + time '10:30') at time zone 'Asia/Manila', 'Rabies booster', 'confirmed')
  on conflict (id) do nothing;

  insert into public.reminders (id, pet_id, type, sent_to, vaccination_id, appointment_id, due_on, status) values
    ('70000000-0000-4000-8000-000000000001', luna, 'vaccination', 'janicah@pawrecord.test', '80000000-0000-4000-8000-000000000001', null, today + 2, 'pending'),
    ('70000000-0000-4000-8000-000000000002', coco, 'vaccination', 'joseph@pawrecord.test', '80000000-0000-4000-8000-000000000004', null, today + 6, 'pending'),
    ('70000000-0000-4000-8000-000000000003', max_pet, 'appointment', 'arah@pawrecord.test', null, '60000000-0000-4000-8000-000000000005', today + 1, 'pending'),
    ('70000000-0000-4000-8000-000000000004', buddy, 'appointment', 'paul@pawrecord.test', null, '60000000-0000-4000-8000-000000000006', today + 1, 'pending')
  on conflict (id) do nothing;
end;
$$;

commit;
