-- KeyRent · 0001 · Fondamenta: estensioni, identità, staff, organizzazioni, sedi, audit
-- Convenzioni: uuid, importi in centesimi (integer), timestamptz UTC, updated_at via trigger.
-- Le funzioni interne vivono nello schema `private` (non esposto dalle API Supabase).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists cube;
create extension if not exists earthdistance;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;
-- Nessuna funzione nuova è eseguibile da tutti per default: i permessi si concedono esplicitamente
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('admin', 'operations', 'customer_care', 'marketing', 'accounting');
create type public.org_role as enum ('owner', 'manager', 'staff');
create type public.org_verification as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.inventory_kind as enum ('direct', 'connect', 'partner');

-- ---------------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profilo personale (1:1 con auth.users). Modificabile solo dall'utente.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  first_name            text,
  last_name             text,
  phone                 text,
  locale                text not null default 'it',
  birth_date            date,
  driving_license_since date,
  identity_status       text not null default 'unverified'
                        check (identity_status in ('unverified', 'pending', 'verified', 'rejected')),
  is_blocked            boolean not null default false,   -- unico campo che lo staff può toccare (con audit)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Crea il profilo alla registrazione (pattern Supabase)
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Staff interno KeyRent: tabella separata, mai membri di un'organizzazione.
-- ---------------------------------------------------------------------------
create table public.staff_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       public.staff_role not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fonti di inventario (Direct / Connect / Partner)
-- ---------------------------------------------------------------------------
create table public.inventory_sources (
  id         uuid primary key default gen_random_uuid(),
  kind       public.inventory_kind not null,
  name       text not null unique,
  rules      jsonb not null default '{}'::jsonb,  -- regole commerciali per fonte
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organizzazioni (anagrafica business del provider)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id                       uuid primary key default gen_random_uuid(),
  legal_name               text not null,
  trade_name               text,
  vat_number               text not null unique check (vat_number ~ '^[A-Z]{0,2}[0-9A-Z]{8,14}$'),
  tax_code                 text,
  sdi_code                 text,
  pec                      text,
  legal_address            jsonb not null default '{}'::jsonb,
  business_email           text,
  business_phone           text,
  website                  text,
  verification_status      public.org_verification not null default 'pending',
  inventory_source_id      uuid references public.inventory_sources(id),
  stripe_account_id        text unique,
  stripe_onboarding_status text not null default 'not_started'
                           check (stripe_onboarding_status in ('not_started', 'pending', 'complete', 'restricted')),
  response_window_minutes  integer not null default 1440 check (response_window_minutes between 30 and 4320),
  created_by               uuid references auth.users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.org_role not null,
  location_ids    uuid[],            -- per il ruolo staff: sedi assegnate (null = tutte)
  status          text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

-- ---------------------------------------------------------------------------
-- Sedi. Indirizzo, telefono e istruzioni sono dati operativi riservati.
-- ---------------------------------------------------------------------------
create table public.locations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  address_line        text not null,
  postal_code         text not null,
  city                text not null,
  province            char(2) not null,
  region              text,
  country             char(2) not null default 'IT',
  latitude            double precision not null check (latitude between -90 and 90),
  longitude           double precision not null check (longitude between -180 and 180),
  timezone            text not null default 'Europe/Rome',
  opening_hours       jsonb not null default '{}'::jsonb,
  pickup_instructions text,
  phone               text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, organization_id)       -- per FK composte: un mezzo non può stare nella sede di un altro provider
);
create index locations_org_idx on public.locations(organization_id);
create index locations_earth_idx on public.locations using gist (ll_to_earth(latitude, longitude));
create trigger locations_touch before update on public.locations
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log: append-only
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_type  text not null check (actor_type in ('user', 'staff', 'system', 'webhook')),
  entity      text not null,
  entity_id   uuid,
  action      text not null,
  diff        jsonb,
  reason      text,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity, entity_id, created_at desc);

create or replace function private.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE: % non può essere modificata o cancellata', tg_table_name
    using errcode = 'P0001';
end $$;

create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function private.forbid_mutation();

create or replace function private.audit(
  p_actor uuid, p_actor_type text, p_entity text, p_entity_id uuid,
  p_action text, p_diff jsonb default null, p_reason text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, actor_type, entity, entity_id, action, diff, reason)
  values (p_actor, p_actor_type, p_entity, p_entity_id, p_action, p_diff, p_reason);
$$;
