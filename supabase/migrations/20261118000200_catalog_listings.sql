-- KeyRent · 0002 · Catalogo master, mezzi fisici, annunci, revisioni, prezzi, commissioni

-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_it    text not null,
  sort       integer not null default 0,
  active     boolean not null default true
);

create table public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  slug        text not null,
  name_it     text not null,
  sort        integer not null default 0,
  unique (category_id, slug)
);

create table public.makes (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique,
  name  text not null
);

create table public.models (
  id          uuid primary key default gen_random_uuid(),
  make_id     uuid not null references public.makes(id),
  category_id uuid not null references public.categories(id),
  slug        text not null,
  name        text not null,
  unique (make_id, category_id, slug)
);
create index models_make_cat_idx on public.models(make_id, category_id);

create type public.spec_source as enum ('licensed', 'curated', 'provider');

create table public.versions (
  id         uuid primary key default gen_random_uuid(),
  model_id   uuid not null references public.models(id),
  name       text not null,
  year_from  smallint,
  year_to    smallint,
  specs      jsonb not null default '{}'::jsonb,  -- es. {"fuel":"benzina","gearbox":"automatico","power_kw":478}
  source     public.spec_source not null default 'curated'
);
create index versions_model_idx on public.versions(model_id);

-- Attributi per categoria: diventano filtri senza nuove colonne
create table public.attribute_definitions (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  key         text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label_it    text not null,
  data_type   text not null check (data_type in ('number', 'text', 'enum', 'boolean')),
  unit        text,
  options     jsonb,                 -- per enum: ["benzina","diesel",...]
  filterable  boolean not null default false,
  required    boolean not null default false,
  sort        integer not null default 0,
  unique (category_id, key)
);

-- kW ↔ CV (1 CV = 0,73549875 kW). Usata da UI e validazione, mai dati inventati.
create or replace function public.kw_to_cv(kw numeric) returns integer
language sql immutable as $$ select round(kw / 0.73549875)::integer $$;
create or replace function public.cv_to_kw(cv numeric) returns integer
language sql immutable as $$ select round(cv * 0.73549875)::integer $$;

-- ---------------------------------------------------------------------------
-- Mezzi fisici
-- ---------------------------------------------------------------------------
create table public.vehicle_units (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  location_id        uuid not null,
  category_id        uuid not null references public.categories(id),
  subcategory_id     uuid references public.subcategories(id),
  make_id            uuid references public.makes(id),
  model_id           uuid references public.models(id),
  version_id         uuid references public.versions(id),
  custom_make        text,             -- se la marca non è a catalogo
  custom_model       text,
  label              text,             -- es. "Bici #07" per le unità in pool
  plate              text,             -- facoltativi per le unità in pool
  vin                text,
  serial_number      text,
  year               smallint check (year between 1950 and 2100),
  attributes         jsonb not null default '{}'::jsonb,
  operational_status text not null default 'active'
                     check (operational_status in ('active', 'maintenance', 'retired')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (location_id, organization_id) references public.locations(id, organization_id)
);
create index vehicle_units_org_idx on public.vehicle_units(organization_id);
create trigger vehicle_units_touch before update on public.vehicle_units
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Annunci (offerta pubblicata)
-- ---------------------------------------------------------------------------
create type public.listing_status as enum
  ('draft', 'pending_review', 'changes_required', 'approved', 'published', 'rejected', 'suspended', 'unpublished');

create table public.listings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  location_id           uuid not null,
  inventory_kind        public.inventory_kind not null default 'direct',
  category_id           uuid not null references public.categories(id),
  subcategory_id        uuid references public.subcategories(id),
  make_id               uuid references public.makes(id),
  model_id              uuid references public.models(id),
  version_id            uuid references public.versions(id),
  title                 text not null check (length(title) between 3 and 120),
  slug                  text not null,
  description           text,
  attributes            jsonb not null default '{}'::jsonb,   -- specifiche (copiate dalla versione o inserite)
  status                public.listing_status not null default 'draft',
  quantity_mode         text not null default 'single' check (quantity_mode in ('single', 'pool')),
  instant_book          boolean not null default false,
  published_revision_id uuid,
  price_from_cents      integer,          -- denormalizzato per ricerca/ordinamento
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (location_id, organization_id) references public.locations(id, organization_id)
);
create index listings_org_idx on public.listings(organization_id);
create index listings_search_idx on public.listings(category_id, make_id, model_id) where status = 'published';
create index listings_attrs_idx on public.listings using gin (attributes jsonb_path_ops);
create trigger listings_touch before update on public.listings
  for each row execute function private.touch_updated_at();

create table public.listing_units (
  listing_id      uuid not null references public.listings(id) on delete cascade,
  vehicle_unit_id uuid not null references public.vehicle_units(id) on delete cascade,
  primary key (listing_id, vehicle_unit_id)
);
create index listing_units_unit_idx on public.listing_units(vehicle_unit_id);

-- Un'unità può essere collegata solo ad annunci della stessa organizzazione;
-- un annuncio 'single' ha al massimo un'unità.
create or replace function private.check_listing_unit() returns trigger
language plpgsql as $$
declare
  l_org uuid; u_org uuid; l_mode text; n integer;
begin
  select organization_id, quantity_mode into l_org, l_mode from public.listings where id = new.listing_id;
  select organization_id into u_org from public.vehicle_units where id = new.vehicle_unit_id;
  if l_org is distinct from u_org then
    raise exception 'TENANT_MISMATCH: unità e annuncio appartengono a provider diversi' using errcode = 'P0001';
  end if;
  if l_mode = 'single' then
    select count(*) into n from public.listing_units where listing_id = new.listing_id;
    if n >= 1 then
      raise exception 'SINGLE_LISTING: un annuncio singolo ha una sola unità' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger listing_units_check before insert or update on public.listing_units
  for each row execute function private.check_listing_unit();

-- Revisioni: snapshot completo; la pubblicata resta online mentre la nuova è in revisione
create table public.listing_revisions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  number        integer not null,
  snapshot      jsonb not null,
  status        text not null default 'pending_review'
                check (status in ('pending_review', 'changes_required', 'approved', 'rejected', 'superseded')),
  submitted_by  uuid references auth.users(id),
  submitted_at  timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  review_notes  jsonb,               -- note per campo: {"photos":"servono foto degli interni"}
  unique (listing_id, number)
);
alter table public.listings
  add constraint listings_published_revision_fk
  foreign key (published_revision_id) references public.listing_revisions(id);

create table public.listing_media (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.listings(id) on delete cascade,
  storage_path      text not null,
  sort              integer not null default 0,
  alt               text,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at        timestamptz not null default now()
);
create index listing_media_listing_idx on public.listing_media(listing_id, sort);

-- ---------------------------------------------------------------------------
-- Condizioni, prezzi, extra
-- ---------------------------------------------------------------------------
create table public.cancellation_policies (
  id     uuid primary key default gen_random_uuid(),
  code   text not null unique,
  name   text not null
);

-- Versioni immutabili: ogni booking punta a quella accettata dal cliente
create table public.cancellation_policy_versions (
  id             uuid primary key default gen_random_uuid(),
  policy_id      uuid not null references public.cancellation_policies(id),
  version        integer not null,
  rules          jsonb not null,
  effective_from timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (policy_id, version)
);
create trigger cancellation_policy_versions_immutable before update or delete
  on public.cancellation_policy_versions for each row execute function private.forbid_mutation();

create table public.rental_terms (
  listing_id             uuid primary key references public.listings(id) on delete cascade,
  included_km_per_day    integer,
  extra_km_cents         integer,
  min_driver_age         smallint,
  min_license_years      smallint,
  required_license       text,              -- B, A2, nautica, ...
  fuel_policy            text,
  insurance_excess_cents integer,
  deposit_cents          integer not null default 0 check (deposit_cents >= 0),
  deposit_mode           text not null default 'at_pickup' check (deposit_mode in ('at_pickup', 'stripe_hold')),
  min_duration_minutes   integer not null default 60,
  max_duration_minutes   integer,
  buffer_minutes         integer not null default 0 check (buffer_minutes between 0 and 2880),
  cancellation_policy_id uuid references public.cancellation_policies(id),
  notes                  text
);

create type public.price_unit as enum ('hour', 'half_day', 'day', 'week');

create table public.pricing_rules (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  unit        public.price_unit not null,
  price_cents integer not null check (price_cents > 0),
  valid_from  date,                 -- stagionalità (null = sempre)
  valid_to    date,
  priority    integer not null default 0,
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index pricing_rules_listing_idx on public.pricing_rules(listing_id);

create table public.extras (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  name        text not null,
  price_cents integer not null check (price_cents >= 0),
  charge      text not null check (charge in ('per_rental', 'per_day')),
  max_qty     integer not null default 1 check (max_qty >= 1)
);

-- ---------------------------------------------------------------------------
-- Commissioni: per categoria, con override per organizzazione. Valori da definire.
-- ---------------------------------------------------------------------------
create table public.commission_rules (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.categories(id),
  organization_id uuid references public.organizations(id),
  rate_bps        integer not null check (rate_bps between 0 and 5000),   -- 500 = 5%
  min_fee_cents   integer not null default 0 check (min_fee_cents >= 0),
  valid_from      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Regola più specifica valida al momento: org+categoria > org > categoria > globale
create or replace function private.commission_for(p_org uuid, p_category uuid, p_at timestamptz default now())
returns table (rate_bps integer, min_fee_cents integer)
language sql stable security definer set search_path = public as $$
  select r.rate_bps, r.min_fee_cents
  from public.commission_rules r
  where r.valid_from <= p_at
    and (r.organization_id is null or r.organization_id = p_org)
    and (r.category_id is null or r.category_id = p_category)
  order by (r.organization_id is not null) desc, (r.category_id is not null) desc, r.valid_from desc
  limit 1
$$;
