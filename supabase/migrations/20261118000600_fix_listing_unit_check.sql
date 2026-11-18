-- KeyRent · 0006 · Il controllo "annuncio singolo = una sola unità" ignora il ricollegamento della stessa unità
-- (rende idempotenti import e sincronizzazioni).
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
    select count(*) into n from public.listing_units
     where listing_id = new.listing_id and vehicle_unit_id <> new.vehicle_unit_id;
    if n >= 1 then
      raise exception 'SINGLE_LISTING: un annuncio singolo ha una sola unità' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.check_listing_unit() from public, anon, authenticated;
