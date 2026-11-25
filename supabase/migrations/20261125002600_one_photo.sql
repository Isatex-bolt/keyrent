-- 0026 · Basta una foto per pubblicare un annuncio (prima: 4). Rieseguibile.
create or replace function private.assert_listing_complete(p_listing uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare l record; o record; missing text[] := '{}'; min_photos constant integer := 1;
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
    missing := missing || 'almeno una foto'::text;
  end if;
  if not exists (select 1 from locations where id = l.location_id and active) then missing := missing || 'sede attiva'::text; end if;
  if cardinality(missing) > 0 then
    raise exception 'LISTING_INCOMPLETE: %', array_to_string(missing, ', ') using errcode = 'P0001';
  end if;
end $$;

