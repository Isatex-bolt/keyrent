-- 0022 · Noleggio a lungo termine, deciso dal noleggiatore per ogni mezzo.
-- short_term_enabled / long_term_enabled: almeno uno. Lungo termine: rata mensile per durata (12/24/36/48 mesi),
-- km annui inclusi + costo km extra, servizi facoltativi (bollo, assicurazione, gomme, tagliandi, auto sostitutiva)
-- ognuno con offerto sì/no e prezzo al mese (0 = incluso). Su annuncio online passa dalla revisione. Rieseguibile.

alter table public.rental_terms add column if not exists short_term_enabled boolean not null default true;
alter table public.rental_terms add column if not exists long_term_enabled boolean not null default false;
alter table public.rental_terms add column if not exists lt_prices jsonb not null default '{}'::jsonb;   -- {"12": 39000, "36": 32000}
alter table public.rental_terms add column if not exists lt_services jsonb not null default '{}'::jsonb; -- {"bollo": {"offered": true, "cents": 1500}}
alter table public.rental_terms add column if not exists lt_km_per_year integer;
alter table public.rental_terms add column if not exists lt_extra_km_cents integer;
do $$ begin
  alter table public.rental_terms add constraint rental_terms_modes_check check (
    (short_term_enabled or long_term_enabled)
    and (not long_term_enabled or (jsonb_path_exists(lt_prices, '$.* ? (@ > 0)') and coalesce(lt_km_per_year, 0) > 0)));
exception when duplicate_object then null; end $$;

-- Un annuncio solo a lungo termine non ha tariffe giornaliere: basta la rata mensile
create or replace function private.assert_listing_complete(p_listing uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare l record; o record; missing text[] := '{}'; min_photos constant integer := 4;
begin
  select * into l from listings where id = p_listing;
  select * into o from organizations where id = l.organization_id;
  if o.verification_status <> 'verified' then missing := missing || 'attività non ancora verificata da KeyRent'::text; end if;
  if l.description is null or length(l.description) < 40 then missing := missing || 'descrizione (almeno 40 caratteri)'::text; end if;
  if not exists (select 1 from listing_units where listing_id = p_listing) then missing := missing || 'almeno un mezzo collegato'::text; end if;
  if not exists (select 1 from pricing_rules where listing_id = p_listing)
     and not exists (select 1 from rental_terms where listing_id = p_listing and long_term_enabled) then
    missing := missing || 'almeno una tariffa'::text;
  end if;
  if not exists (select 1 from rental_terms where listing_id = p_listing) then missing := missing || 'condizioni di noleggio'::text; end if;
  if (select count(*) from listing_media where listing_id = p_listing and moderation_status <> 'rejected') < min_photos then
    missing := missing || format('almeno %s foto', min_photos);
  end if;
  if not exists (select 1 from locations where id = l.location_id and active) then missing := missing || 'sede attiva'::text; end if;
  if cardinality(missing) > 0 then
    raise exception 'LISTING_INCOMPLETE: %', array_to_string(missing, ', ') using errcode = 'P0001';
  end if;
end $$;

-- Dal browser: consegna e lungo termine si cambiano solo su bozze o annunci da correggere
create or replace function private.guard_delivery_terms() returns trigger
language plpgsql set search_path = public as $$
declare st text;
begin
  if current_user <> 'authenticated' then return new; end if;
  if (new.delivery_enabled, new.delivery_radius_km, new.delivery_fee_cents, new.delivery_per_km_cents,
      new.short_term_enabled, new.long_term_enabled, new.lt_prices, new.lt_services, new.lt_km_per_year, new.lt_extra_km_cents)
     is not distinct from
     (old.delivery_enabled, old.delivery_radius_km, old.delivery_fee_cents, old.delivery_per_km_cents,
      old.short_term_enabled, old.long_term_enabled, old.lt_prices, old.lt_services, old.lt_km_per_year, old.lt_extra_km_cents) then
    return new;
  end if;
  select status into st from listings where id = new.listing_id;
  if st not in ('draft', 'changes_required') then raise exception 'DELIVERY_NEEDS_REVIEW' using errcode = 'P0001'; end if;
  return new;
end $$;

-- Revisione approvata: applica anche le modalità di noleggio e il lungo termine proposti
create or replace function private.apply_revision_long_term() returns trigger
language plpgsql security definer set search_path = public as $$
declare t jsonb := new.snapshot -> 'changes' -> 'terms';
begin
  if new.status::text = 'approved' and old.status::text <> 'approved' and t ? 'long_term_enabled' then
    update rental_terms set
      short_term_enabled = coalesce((t ->> 'short_term_enabled')::boolean, true),
      long_term_enabled = coalesce((t ->> 'long_term_enabled')::boolean, false),
      lt_prices = coalesce(t -> 'lt_prices', '{}'::jsonb),
      lt_services = coalesce(t -> 'lt_services', '{}'::jsonb),
      lt_km_per_year = nullif(t ->> 'lt_km_per_year', '')::integer,
      lt_extra_km_cents = nullif(t ->> 'lt_extra_km_cents', '')::integer
     where listing_id = new.listing_id;
  end if;
  return new;
end $$;
drop trigger if exists listing_revisions_long_term on public.listing_revisions;
create trigger listing_revisions_long_term after update on public.listing_revisions
  for each row execute function private.apply_revision_long_term();

-- Offerte (breve / lungo termine) degli annunci pubblicati, per ricerca e scheda
create or replace function public.listing_offers(p_ids uuid[])
returns table (listing_id uuid, short_term boolean, long_term boolean, lt_prices jsonb, lt_services jsonb,
               lt_km_per_year integer, lt_extra_km_cents integer, lt_from_cents integer)
language sql stable security definer set search_path = public as $$
  select t.listing_id, t.short_term_enabled, t.long_term_enabled, t.lt_prices, t.lt_services, t.lt_km_per_year, t.lt_extra_km_cents,
         (select min(v::integer) from jsonb_each_text(t.lt_prices) as e(k, v) where v::integer > 0)
    from rental_terms t join listings l on l.id = t.listing_id
   where t.listing_id = any (p_ids) and l.status = 'published';
$$;
revoke execute on function public.listing_offers(uuid[]) from public;
grant execute on function public.listing_offers(uuid[]) to anon, authenticated;
