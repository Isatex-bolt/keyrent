-- 0027 · Demo personale per ogni visitatore: chi entra da /demo riceve una COPIA dell'attività dimostrativa
-- (10 annunci, sedi, noleggi finti) con un utente tutto suo. Nessuno vede le modifiche degli altri.
-- Le copie non compaiono sul sito pubblico (gli esempi pubblici sono solo quelli dell'originale) e si cancellano dopo 24 ore.
-- Gli annunci NUOVI creati in una copia restano pubblici 24 ore, come deciso. Rieseguibile.

alter table public.organizations add column if not exists demo_clone_of uuid references public.organizations(id) on delete set null;
alter table public.listings add column if not exists demo_source_id uuid;

-- Vista pubblica: uguale a prima, ma senza gli annunci di esempio delle copie
create or replace view public.public_listings with (security_barrier = true) as
select
  l.id, l.slug, l.title, l.description, l.attributes, l.quantity_mode, l.instant_book,
  l.price_from_cents, l.published_at,
  c.slug as category_slug, c.name_it as category_name,
  sc.slug as subcategory_slug, sc.name_it as subcategory_name,
  mk.slug as make_slug, coalesce(mk.name, (select vu.custom_make from vehicle_units vu join listing_units lu on lu.vehicle_unit_id = vu.id where lu.listing_id = l.id limit 1)) as make_name,
  md.slug as model_slug, md.name as model_name,
  v.name as version_name,
  loc.city, loc.province, loc.region,
  round(loc.latitude::numeric, 2)::double precision  as approx_latitude,
  round(loc.longitude::numeric, 2)::double precision as approx_longitude,
  (o.verification_status = 'verified') as provider_verified,
  t.deposit_cents, t.deposit_mode, t.min_driver_age, t.min_license_years, t.required_license,
  t.included_km_per_day, t.extra_km_cents, t.fuel_policy, t.insurance_excess_cents,
  t.min_duration_minutes, t.cancellation_policy_id,
  (select count(*) from listing_units lu join vehicle_units vu on vu.id = lu.vehicle_unit_id
    where lu.listing_id = l.id and vu.operational_status = 'active') as units_count
from listings l
join categories c on c.id = l.category_id
left join subcategories sc on sc.id = l.subcategory_id
left join makes mk on mk.id = l.make_id
left join models md on md.id = l.model_id
left join versions v on v.id = l.version_id
join locations loc on loc.id = l.location_id
join organizations o on o.id = l.organization_id
left join rental_terms t on t.listing_id = l.id
where l.status = 'published'
  and not (l.demo_keep and o.demo_clone_of is not null);

-- ---------- Copia dell'attività dimostrativa per un nuovo utente ----------
create or replace function private.demo_clone(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src uuid; dst uuid := gen_random_uuid(); r record; u record; v_loc uuid; v_listing uuid; v_unit uuid;
  locs jsonb := '{}'; units jsonb := '{}';
begin
  select id into src from organizations where is_demo and demo_clone_of is null order by created_at limit 1;
  if src is null then raise exception 'DEMO_TEMPLATE_MISSING' using errcode = 'P0001'; end if;

  insert into organizations (id, kind, legal_name, trade_name, vat_number, verification_status, stripe_onboarding_status,
                             business_email, legal_address, inventory_source_id, response_window_minutes, created_by, is_demo, demo_clone_of)
  select dst, kind, legal_name, trade_name, 'DM' || upper(substr(replace(dst::text, '-', ''), 1, 12)), verification_status,
         stripe_onboarding_status, business_email, legal_address, inventory_source_id, response_window_minutes, p_user, true, src
    from organizations where id = src;
  insert into organization_members (organization_id, user_id, role, status) values (dst, p_user, 'owner', 'active');

  for r in select * from locations where organization_id = src loop
    v_loc := gen_random_uuid();
    locs := locs || jsonb_build_object(r.id::text, v_loc);
    insert into locations (id, organization_id, name, address_line, postal_code, city, province, region, country, latitude, longitude,
                           timezone, opening_hours, pickup_instructions, phone, active)
    values (v_loc, dst, r.name, r.address_line, r.postal_code, r.city, r.province, r.region, r.country, r.latitude, r.longitude,
            r.timezone, r.opening_hours, r.pickup_instructions, r.phone, r.active);
  end loop;

  for r in select * from listings where organization_id = src and demo_keep order by created_at loop
    v_listing := gen_random_uuid();
    insert into listings (id, organization_id, location_id, inventory_kind, category_id, subcategory_id, make_id, model_id, version_id,
                          title, slug, description, attributes, status, quantity_mode, price_from_cents, published_at,
                          demo_keep, demo_source_id, created_at)
    values (v_listing, dst, (locs ->> r.location_id::text)::uuid, r.inventory_kind, r.category_id, r.subcategory_id, r.make_id, r.model_id,
            r.version_id, r.title, r.slug, r.description, r.attributes, 'published', r.quantity_mode, r.price_from_cents, now(),
            true, r.id, r.created_at);
    for u in select vu.* from listing_units lu join vehicle_units vu on vu.id = lu.vehicle_unit_id where lu.listing_id = r.id loop
      v_unit := gen_random_uuid();
      insert into vehicle_units (id, organization_id, location_id, category_id, subcategory_id, make_id, model_id, version_id,
                                 custom_make, custom_model, label, year, attributes, operational_status)
      values (v_unit, dst, (locs ->> u.location_id::text)::uuid, u.category_id, u.subcategory_id, u.make_id, u.model_id, u.version_id,
              u.custom_make, u.custom_model, u.label, u.year, u.attributes, u.operational_status);
      insert into listing_units (listing_id, vehicle_unit_id) values (v_listing, v_unit);
    end loop;
    insert into rental_terms select (jsonb_populate_record(t, jsonb_build_object('listing_id', v_listing))).*
      from rental_terms t where t.listing_id = r.id;
    insert into pricing_rules (listing_id, unit, price_cents, valid_from, valid_to)
      select v_listing, unit, price_cents, valid_from, valid_to from pricing_rules where listing_id = r.id;
    insert into extras (listing_id, name, price_cents, charge, max_qty)
      select v_listing, name, price_cents, charge, max_qty from extras where listing_id = r.id;
    -- stesse foto (stesso file su Storage): la copia non le può cancellare (annunci di esempio protetti)
    insert into listing_media (listing_id, storage_path, sort, alt, moderation_status, is_indicative)
      select v_listing, storage_path, sort, alt, 'approved', is_indicative from listing_media where listing_id = r.id;
  end loop;

  perform private.demo_seed_bookings(dst);
  return dst;
end $$;

-- ---------- Pulizia: copie più vecchie di 24 ore, con il loro utente ----------
create or replace function private.demo_cleanup(p_older interval default interval '24 hours') returns integer
language plpgsql security definer set search_path = public as $$
declare o record; v_users uuid[]; n integer := 0;
begin
  perform set_config('keyrent.demo_seed', 'on', true);
  for o in select id from organizations where demo_clone_of is not null and created_at < now() - p_older loop
    select array_agg(user_id) into v_users from organization_members where organization_id = o.id;
    delete from booking_events where booking_id in (select id from bookings where organization_id = o.id);
    delete from ledger_entries where booking_id in (select id from bookings where organization_id = o.id);
    delete from reviews where booking_id in (select id from bookings where organization_id = o.id);
    delete from refunds where booking_id in (select id from bookings where organization_id = o.id);
    delete from payments where booking_id in (select id from bookings where organization_id = o.id);
    delete from payouts where organization_id = o.id;
    delete from unit_reservations where vehicle_unit_id in (select id from vehicle_units where organization_id = o.id);
    delete from conversations where organization_id = o.id;
    delete from bookings where organization_id = o.id;
    delete from listings where organization_id = o.id;
    delete from vehicle_units where organization_id = o.id;
    delete from organizations where id = o.id;
    -- utenti creati per la demo (email @prova.keyrent.it): via anche loro
    if v_users is not null then
      delete from support_messages where sender_id = any (v_users);
      delete from messages where sender_id = any (v_users);
      delete from auth.users where id = any (v_users) and email like '%@prova.keyrent.it';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Il ripristino notturno pulisce anche le copie scadute
create or replace function public.svc_demo_reset() returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_clean integer; v_res jsonb;
begin
  v_clean := private.demo_cleanup();
  v_res := private.demo_reset();
  return v_res || jsonb_build_object('copie_cancellate', v_clean);
end $$;

create or replace function public.svc_demo_clone(p_user uuid) returns uuid
language sql security invoker set search_path = public as $$ select private.demo_clone(p_user); $$;
create or replace function public.svc_demo_clones_active() returns integer
language sql stable security invoker set search_path = public as $$
  select count(*)::integer from organizations where demo_clone_of is not null;
$$;

revoke execute on function public.svc_demo_reset(), public.svc_demo_clone(uuid), public.svc_demo_clones_active()
  from public, anon, authenticated;
grant execute on function public.svc_demo_reset(), public.svc_demo_clone(uuid), public.svc_demo_clones_active() to service_role;
revoke execute on function private.demo_clone(uuid), private.demo_cleanup(interval) from public;
grant execute on function private.demo_clone(uuid), private.demo_cleanup(interval) to service_role;
