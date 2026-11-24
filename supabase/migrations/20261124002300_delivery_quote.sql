-- 0023 · Prezzo della consegna a domicilio / in azienda, calcolato dal database.
-- Distanza in linea d'aria dalla sede del mezzo, arrotondata al km intero in su.
-- Prezzo = fisso + km × prezzo al km. Fuori dal raggio: in_range = false, nessun prezzo.
-- Non restituisce mai le coordinate della sede (decisione D1).
create or replace function public.delivery_quote(p_listing uuid, p_lat double precision, p_lng double precision)
returns table (km integer, cents integer, in_range boolean, radius_km integer)
language sql stable security definer set search_path = public as $$
  with d as (
    select t.delivery_radius_km as r, t.delivery_fee_cents as fee, t.delivery_per_km_cents as per_km,
           ceil(earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(loc.latitude, loc.longitude)) / 1000)::integer as km
      from listings l
      join rental_terms t on t.listing_id = l.id
      join locations loc on loc.id = l.location_id
     where l.id = p_listing and l.status = 'published' and t.delivery_enabled
       and p_lat between -90 and 90 and p_lng between -180 and 180
  )
  select d.km,
         case when d.km <= d.r then coalesce(d.fee, 0) + d.km * coalesce(d.per_km, 0) end,
         d.km <= d.r, d.r
    from d;
$$;
revoke execute on function public.delivery_quote(uuid, double precision, double precision) from public;
grant execute on function public.delivery_quote(uuid, double precision, double precision) to anon, authenticated;
