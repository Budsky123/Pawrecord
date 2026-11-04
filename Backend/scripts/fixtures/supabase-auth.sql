-- Test-only contract fixture. Never apply this to Supabase; auth is managed there.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;

-- PGlite does not package pgcrypto's password helpers. The database tests do
-- not authenticate passwords, so provide deterministic fixture-only stand-ins.
create function extensions.gen_salt(text) returns text
language sql immutable as $$ select 'test-salt'::text $$;
create function extensions.crypt(text, text) returns text
language sql immutable as $$ select 'test-password-hash'::text $$;

create table auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  confirmation_token text default '',
  recovery_token text default '',
  email_change_token_new text default '',
  email_change text default '',
  email_change_token_current text default '',
  phone_change text default '',
  phone_change_token text default '',
  reauthentication_token text default '',
  email_change_confirm_status integer default 0
);
create table auth.identities (
  id uuid primary key,
  user_id uuid not null references auth.users (id),
  provider_id text not null,
  identity_data jsonb not null,
  provider text not null,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz,
  unique (provider_id, provider)
);
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
