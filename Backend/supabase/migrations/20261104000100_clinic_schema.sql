-- One clinic, eight tables. PostgreSQL 15+ is required for security_invoker views.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- Keep extension-backed defaults resolvable when this migration is run outside
-- Supabase's API session (for example through the CLI or PGlite test runner).
-- PostgreSQL 13+ provides gen_random_uuid() in core, so no pgcrypto package is
-- required by the local PGlite verification harness.
set search_path = public, extensions;

create type public.app_role as enum ('vet', 'staff', 'owner');
create type public.pet_sex as enum ('female', 'male', 'unknown');
create type public.health_status as enum ('healthy', 'follow_up', 'medication');
create type public.visit_category as enum ('wellness', 'vaccination', 'dental', 'other');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.reminder_type as enum ('vaccination', 'appointment');
create type public.reminder_status as enum ('pending', 'sent', 'failed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  role public.app_role not null default 'owner',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  species text not null check (length(btrim(species)) between 1 and 50),
  breed text,
  birth_date date,
  sex public.pet_sex not null default 'unknown',
  photo_url text,
  health_status public.health_status not null default 'healthy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vaccine_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 100),
  interval_days integer not null check (interval_days between 1 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete restrict,
  vaccine_type_id uuid not null references public.vaccine_types (id) on delete restrict,
  given_on date not null,
  -- Filled by the trigger; a caller cannot override the computed date.
  next_due_on date not null,
  administered_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vaccination_due_after_given check (next_due_on > given_on)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete restrict,
  vet_id uuid not null references public.profiles (id) on delete restrict,
  visit_date timestamptz not null default now(),
  category public.visit_category not null default 'other',
  reason text not null check (length(btrim(reason)) between 1 and 250),
  diagnosis text,
  treatment text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete restrict,
  vet_id uuid not null references public.profiles (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 1 and 250),
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_positive_duration check (ends_at > starts_at)
);

-- Half-open intervals allow a 10:00 visit directly after a 09:30–10:00 visit.
-- Keeping this in PostgreSQL closes the race between two clients booking at once.
-- Finished visits retain their slots; cancelled/no-show slots can be booked again.
set search_path = public, extensions;
alter table public.appointments add constraint appointments_vet_no_overlap
  exclude using gist (
    vet_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'));
reset search_path;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete restrict,
  type public.reminder_type not null,
  sent_to text not null check (sent_to ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  sent_at timestamptz,
  status public.reminder_status not null default 'pending',
  -- These source IDs and the due date let Phase 6 atomically claim one delivery
  -- per care event. Failed sends retry by updating the same row.
  vaccination_id uuid references public.vaccinations (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete restrict,
  due_on date not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_matches_source check (
    (type = 'vaccination' and vaccination_id is not null and appointment_id is null)
    or (type = 'appointment' and appointment_id is not null and vaccination_id is null)
  ),
  constraint sent_reminder_has_timestamp check (status <> 'sent' or sent_at is not null)
);

create index profiles_role_idx on public.profiles (role);
-- owners.profile_id already has a unique index for the RLS lookup.
create index pets_owner_id_idx on public.pets (owner_id);
create index vaccinations_pet_type_date_idx on public.vaccinations (pet_id, vaccine_type_id, given_on desc);
create index vaccinations_vaccine_type_id_idx on public.vaccinations (vaccine_type_id);
create index vaccinations_administered_by_idx on public.vaccinations (administered_by);
create index vaccinations_next_due_on_idx on public.vaccinations (next_due_on);
create index visits_pet_date_idx on public.visits (pet_id, visit_date desc);
create index visits_vet_id_idx on public.visits (vet_id);
create index visits_active_date_idx on public.visits (visit_date desc) where deleted_at is null;
create index appointments_pet_id_idx on public.appointments (pet_id);
create index appointments_starts_at_idx on public.appointments (starts_at);
create index reminders_pet_id_idx on public.reminders (pet_id);
create index reminders_status_idx on public.reminders (status);
create unique index reminders_one_vaccination_delivery on public.reminders (vaccination_id, due_on)
  where type = 'vaccination';
create unique index reminders_one_appointment_delivery on public.reminders (appointment_id, due_on)
  where type = 'appointment';

-- Enable RLS immediately, before granting API access in the next migration.
alter table public.profiles enable row level security;
alter table public.owners enable row level security;
alter table public.pets enable row level security;
alter table public.vaccine_types enable row level security;
alter table public.vaccinations enable row level security;
alter table public.visits enable row level security;
alter table public.appointments enable row level security;
alter table public.reminders enable row level security;

revoke all on public.profiles, public.owners, public.pets, public.vaccine_types,
  public.vaccinations, public.visits, public.appointments, public.reminders from anon, authenticated;
