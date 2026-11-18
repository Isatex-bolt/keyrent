-- KeyRent · 0010 · Ricerca per area visibile della mappa, con prezzo TOTALE per le date scelte

-- Totale per le date, o null se non calcolabile (durata fuori limiti, nessuna tariffa)
create or replace function private.safe_quote_total(p_listing uuid, p_pickup timestamptz, p_return timestamptz)
returns integer language plpgsql stable security definer set search_path = public as $$
declare t record; minutes numeric;
begin
  if p_pickup is null or p_return is null or p_return <= p_pickup then return null; end if;
  select min_duration_minutes, max_duration_minutes into t from rental_terms where listing_id = p_listing;
  minutes := extract(epoch from (p_return - p_pickup)) / 60;
  if t.min_duration_minutes is not null and minutes < t.min_duration_minutes then return null; end if;
  if t.max_duration_minutes is not null and minutes > t.max_duration_minutes then return null; end if;
  return (private.quote_listing(p_listing, p_pickup, p_return) ->> 'total_cents')::integer;
exception when others then
  return null;
end $$;
revoke execute on function private.safe_quote_total(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.safe_quote_total(uuid, timestamptz, timestamptz) to service_role;

create or replace function public.search_map(
  p_west double precision default null, p_south double precision default null,
  p_east double precision default null, p_north double precision default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km integer default 40,
  p_pickup timestamptz default null, p_return timestamptz default null,
  p_category text default null, p_subcategory text default null, p_make text default null, p_model text default null,
  p_filters jsonb default '{}'::jsonb, p_price_max_cents integer default null, p_instant_only boolean default false,
  p_sort text default 'relevance', p_limit integer default 60, p_offset integer default 0
) returns table (
  id uuid, slug text, title text, category_slug text, subcategory_slug text, make_name text, model_name text,
  city text, province char(2), approx_latitude double precision, approx_longitude double precision,
  instant_book boolean, price_from_cents integer, total_cents integer, attributes jsonb,
  distance_km numeric, available_units bigint, total_count bigint
) language sql stable security definer set search_path = public, extensions as $$
  with base as (
    select pl.*,
           case when p_lat is null then null
                else round((earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(loc.latitude, loc.longitude)) / 1000)::numeric, 1)
           end as dist
    from public_listings pl
    join listings l on l.id = pl.id
    join locations loc on loc.id = l.location_id
    where (p_category is null or pl.category_slug = p_category)
      and (p_subcategory is null or pl.subcategory_slug = p_subcategory)
      and (p_make is null or pl.make_slug = p_make)
      and (p_model is null or pl.model_slug = p_model)
      and (not p_instant_only or pl.instant_book)
      and (p_filters is null or p_filters = '{}'::jsonb or pl.attributes @> p_filters)
      and (p_west is null or (loc.longitude between p_west and p_east and loc.latitude between p_south and p_north))
      and (p_west is not null or p_lat is null
           or earth_box(ll_to_earth(p_lat, p_lng), p_radius_km * 1000) @> ll_to_earth(loc.latitude, loc.longitude))
  ), priced as (
    select b.*,
      private.safe_quote_total(b.id, p_pickup, p_return) as total,
      (select count(*) from listing_units lu join vehicle_units vu on vu.id = lu.vehicle_unit_id
        where lu.listing_id = b.id and vu.operational_status = 'active'
          and (p_pickup is null or not exists (
                select 1 from unit_reservations r
                 where r.vehicle_unit_id = vu.id and r.active
                   and (r.kind <> 'hold' or r.expires_at > now())
                   and r.period && tstzrange(p_pickup, p_return, '[)')))) as free_units
    from base b
    where p_west is not null or p_lat is null or b.dist <= p_radius_km
  )
  select p.id, p.slug, p.title, p.category_slug, p.subcategory_slug, p.make_name, p.model_name, p.city, p.province,
         p.approx_latitude, p.approx_longitude, p.instant_book, p.price_from_cents, p.total, p.attributes,
         p.dist, p.free_units, count(*) over ()
  from priced p
  where p.free_units > 0
    and (p_pickup is null or p.total is not null)
    and (p_price_max_cents is null or coalesce(p.total, p.price_from_cents) <= p_price_max_cents)
  order by
    case when p_sort = 'price_asc' then coalesce(p.total, p.price_from_cents) end asc nulls last,
    case when p_sort = 'price_desc' then coalesce(p.total, p.price_from_cents) end desc nulls last,
    case when p_sort = 'distance' then p.dist end asc nulls last,
    case when p_sort = 'relevance' then p.instant_book end desc,
    p.published_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
$$;
revoke execute on function public.search_map(double precision, double precision, double precision, double precision,
  double precision, double precision, integer, timestamptz, timestamptz, text, text, text, text, jsonb, integer, boolean,
  text, integer, integer) from public;
grant execute on function public.search_map(double precision, double precision, double precision, double precision,
  double precision, double precision, integer, timestamptz, timestamptz, text, text, text, text, jsonb, integer, boolean,
  text, integer, integer) to anon, authenticated;
