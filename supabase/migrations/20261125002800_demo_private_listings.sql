-- 0028 · Gli annunci creati provando la demo non compaiono sul sito pubblico (li vede solo chi li ha creati, nella sua area).
-- Sul sito pubblico, delle attività demo restano solo i 10 annunci di esempio dell'originale. Rieseguibile.
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
  and (not o.is_demo or (l.demo_keep and o.demo_clone_of is null));
