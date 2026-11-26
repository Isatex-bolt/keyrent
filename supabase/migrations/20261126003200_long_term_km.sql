-- 0032 · Lungo termine: rata per durata E km annui. lt_prices diventa {"36": {"15000": 45900, "25000": 52900}, ...}
-- (resta valido anche il vecchio formato {"36": 45900}, che vale per lt_km_per_year). Rieseguibile.
alter table public.rental_terms drop constraint if exists rental_terms_modes_check;
alter table public.rental_terms add constraint rental_terms_modes_check check (
  (short_term_enabled or long_term_enabled)
  and (not long_term_enabled or (jsonb_path_exists(lt_prices, '$.** ? (@.type() == "number" && @ > 0)') and coalesce(lt_km_per_year, 0) > 0)));

create or replace function public.listing_offers(p_ids uuid[])
returns table (listing_id uuid, short_term boolean, long_term boolean, lt_prices jsonb, lt_services jsonb,
               lt_km_per_year integer, lt_extra_km_cents integer, lt_from_cents integer)
language sql stable security definer set search_path = public as $$
  select t.listing_id, t.short_term_enabled, t.long_term_enabled, t.lt_prices, t.lt_services, t.lt_km_per_year, t.lt_extra_km_cents,
         (select min(v::text::integer) from jsonb_path_query(t.lt_prices, '$.** ? (@.type() == "number" && @ > 0)') as v)
    from rental_terms t join listings l on l.id = t.listing_id
   where t.listing_id = any (p_ids) and l.status = 'published';
$$;
revoke execute on function public.listing_offers(uuid[]) from public;
grant execute on function public.listing_offers(uuid[]) to anon, authenticated;
