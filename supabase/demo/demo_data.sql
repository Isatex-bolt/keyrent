-- KeyRent · DATI DIMOSTRATIVI (da rimuovere prima del lancio con demo_remove.sql)
-- Un noleggiatore fittizio con più sedi e 8 annunci pubblicati, senza foto.
do $$
declare
  org uuid := 'de000000-0000-0000-0000-000000000001';
begin
  insert into organizations (id, legal_name, trade_name, vat_number, verification_status, stripe_onboarding_status,
                             inventory_source_id)
  values (org, 'Demo Noleggi S.r.l.', 'DEMO', 'IT00000000001', 'verified', 'complete',
          (select id from inventory_sources where kind = 'direct' limit 1))
  on conflict (id) do nothing;

  insert into locations (id, organization_id, name, address_line, postal_code, city, province, latitude, longitude) values
    ('de100000-0000-0000-0000-000000000001', org, 'Demo Padova',  'Via Demo 1', '35100', 'Padova',  'PD', 45.4064, 11.8768),
    ('de100000-0000-0000-0000-000000000002', org, 'Demo Vicenza', 'Via Demo 2', '36100', 'Vicenza', 'VI', 45.5455, 11.5354),
    ('de100000-0000-0000-0000-000000000003', org, 'Demo Venezia', 'Via Demo 3', '30100', 'Venezia', 'VE', 45.4408, 12.3155),
    ('de100000-0000-0000-0000-000000000004', org, 'Demo Milano',  'Via Demo 4', '20100', 'Milano',  'MI', 45.4642, 9.19),
    ('de100000-0000-0000-0000-000000000005', org, 'Demo Roma',    'Via Demo 5', '00100', 'Roma',    'RM', 41.9028, 12.4964),
    ('de100000-0000-0000-0000-000000000006', org, 'Demo Bassano', 'Via Demo 6', '36061', 'Bassano del Grappa', 'VI', 45.7656, 11.7344)
  on conflict (id) do nothing;
end $$;

-- annunci: id, sede, categoria, marca, modello, titolo, attributi, modalità, unità, prezzo giorno (cent), prezzo settimana, prezzo ora, cauzione
with spec(n, loc, cat, make, model, title, attrs, mode, units, day, week, hour, deposit, descr) as (values
  (1, 1, 'camper',  'laika',       'kosmo',       'Laika Kosmo 6 posti',        '{"berths":6,"travel_seats":4,"gearbox":"manuale","pets_allowed":true}', 'single', 1, 16000, 98000, null, 100000,
      'Camper mansardato ideale per famiglie: cucina completa, bagno con doccia, veranda e portabici.'),
  (2, 1, 'bici',    'bianchi',     'e-omnia',     'E-bike Bianchi E-Omnia',     '{"electric":true,"frame_size":"M"}', 'pool', 5, 3500, null, 800, 5000,
      'Bici a pedalata assistita per città e colli: batteria per circa 100 km, casco e lucchetto inclusi.'),
  (3, 2, 'auto',    'fiat',        'panda',       'Fiat Panda Hybrid',          '{"fuel":"ibrida","gearbox":"manuale","seats":5}', 'single', 1, 4500, 27000, null, 30000,
      'Utilitaria comoda e parca nei consumi, perfetta per la città e le gite fuori porta.'),
  (4, 3, 'barche',  'zodiac',      'medline',     'Gommone Zodiac Medline',     '{"license_required":false,"max_people":7,"skipper":"opzionale"}', 'single', 1, 28000, null, 6000, 50000,
      'Gommone senza patente per esplorare la laguna in libertà. Carburante escluso.'),
  (5, 4, 'moto',    'ducati',      'monster',     'Ducati Monster',             '{"license":"A","displacement_cc":937}', 'single', 1, 14000, 85000, null, 150000,
      'La naked iconica di Borgo Panigale, agile e divertente. Due caschi disponibili su richiesta.'),
  (6, 5, 'camper',  'volkswagen',  'california',  'Volkswagen California Ocean','{"berths":4,"travel_seats":4,"gearbox":"automatico","pets_allowed":false}', 'single', 1, 19000, 120000, null, 150000,
      'Camper van compatto con tetto a soffietto e cucina: parcheggia ovunque, anche in città.'),
  (7, 2, 'furgoni', 'ford',        'transit',     'Ford Transit 12 m³',         '{"load_m3":12,"seats":3,"license":"B"}', 'single', 1, 9000, 54000, 2500, 50000,
      'Furgone per traslochi e trasporti, sponda e cinghie incluse.'),
  (8, 6, 'auto',    'lamborghini', 'urus',        'Lamborghini Urus',           '{"fuel":"benzina","gearbox":"automatico","seats":5,"power_kw":478,"drivetrain":"integrale"}', 'single', 1, 120000, null, null, 500000,
      'Il super SUV di Sant''Agata: 650 CV per un''esperienza indimenticabile. Età minima 30 anni.')
), ins_listing as (
  insert into listings (id, organization_id, location_id, category_id, make_id, model_id, title, slug, description,
                        attributes, quantity_mode, status, published_at)
  select ('de200000-0000-0000-0000-00000000000' || s.n)::uuid, 'de000000-0000-0000-0000-000000000001',
         ('de100000-0000-0000-0000-00000000000' || s.loc)::uuid, c.id, mk.id, md.id, s.title,
         lower(regexp_replace(s.title, '[^A-Za-z0-9]+', '-', 'g')), s.descr, s.attrs::jsonb, s.mode, 'published', now()
  from spec s
  join categories c on c.slug = s.cat
  join makes mk on mk.slug = s.make
  join models md on md.make_id = mk.id and md.slug = s.model and md.category_id = c.id
  on conflict (id) do nothing
  returning id
)
select count(*) as annunci_creati from ins_listing;

insert into vehicle_units (id, organization_id, location_id, category_id, label)
select ('de30000' || s.n || '-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'de000000-0000-0000-0000-000000000001', ('de100000-0000-0000-0000-00000000000' || s.loc)::uuid, c.id,
       case when s.units > 1 then 'Unità #' || g end
from (values
  (1, 1, 'camper', 1, 16000, 98000, null, 100000), (2, 1, 'bici', 5, 3500, null, 800, 5000),
  (3, 2, 'auto', 1, 4500, 27000, null, 30000), (4, 3, 'barche', 1, 28000, null, 6000, 50000),
  (5, 4, 'moto', 1, 14000, 85000, null, 150000), (6, 5, 'camper', 1, 19000, 120000, null, 150000),
  (7, 2, 'furgoni', 1, 9000, 54000, 2500, 50000), (8, 6, 'auto', 1, 120000, null, null, 500000)
) as s(n, loc, cat, units, day, week, hour, deposit)
join categories c on c.slug = s.cat
cross join lateral generate_series(1, s.units) g
on conflict (id) do nothing;

insert into listing_units (listing_id, vehicle_unit_id)
select ('de200000-0000-0000-0000-00000000000' || s.n)::uuid, ('de30000' || s.n || '-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid
from (values
  (1, 1, 'camper', 1, 16000, 98000, null, 100000), (2, 1, 'bici', 5, 3500, null, 800, 5000),
  (3, 2, 'auto', 1, 4500, 27000, null, 30000), (4, 3, 'barche', 1, 28000, null, 6000, 50000),
  (5, 4, 'moto', 1, 14000, 85000, null, 150000), (6, 5, 'camper', 1, 19000, 120000, null, 150000),
  (7, 2, 'furgoni', 1, 9000, 54000, 2500, 50000), (8, 6, 'auto', 1, 120000, null, null, 500000)
) as s(n, loc, cat, units, day, week, hour, deposit)
cross join lateral generate_series(1, s.units) g
on conflict do nothing;

insert into rental_terms (listing_id, deposit_cents, min_duration_minutes, buffer_minutes, min_driver_age, included_km_per_day)
select ('de200000-0000-0000-0000-00000000000' || s.n)::uuid, s.deposit,
       case when s.hour is not null then 60 else 1440 end,
       case when s.cat = 'camper' then 120 else 30 end,
       case s.cat when 'auto' then case when s.day > 50000 then 30 else 21 end when 'camper' then 25 when 'moto' then 24 when 'furgoni' then 21 else 14 end,
       case when s.cat in ('auto', 'camper', 'furgoni', 'moto') then 250 end
from (values
  (1, 1, 'camper', 1, 16000, 98000, null, 100000), (2, 1, 'bici', 5, 3500, null, 800, 5000),
  (3, 2, 'auto', 1, 4500, 27000, null, 30000), (4, 3, 'barche', 1, 28000, null, 6000, 50000),
  (5, 4, 'moto', 1, 14000, 85000, null, 150000), (6, 5, 'camper', 1, 19000, 120000, null, 150000),
  (7, 2, 'furgoni', 1, 9000, 54000, 2500, 50000), (8, 6, 'auto', 1, 120000, null, null, 500000)
) as s(n, loc, cat, units, day, week, hour, deposit)
on conflict (listing_id) do nothing;

insert into pricing_rules (listing_id, unit, price_cents)
select ('de200000-0000-0000-0000-00000000000' || s.n)::uuid, u.unit::price_unit, u.price
from (values
  (1, 1, 'camper', 1, 16000, 98000, null, 100000), (2, 1, 'bici', 5, 3500, null, 800, 5000),
  (3, 2, 'auto', 1, 4500, 27000, null, 30000), (4, 3, 'barche', 1, 28000, null, 6000, 50000),
  (5, 4, 'moto', 1, 14000, 85000, null, 150000), (6, 5, 'camper', 1, 19000, 120000, null, 150000),
  (7, 2, 'furgoni', 1, 9000, 54000, 2500, 50000), (8, 6, 'auto', 1, 120000, null, null, 500000)
) as s(n, loc, cat, units, day, week, hour, deposit)
cross join lateral (values ('day', s.day), ('week', s.week), ('hour', s.hour)) as u(unit, price)
where u.price is not null
  and not exists (select 1 from pricing_rules p where p.listing_id = ('de200000-0000-0000-0000-00000000000' || s.n)::uuid);

update listings l set price_from_cents = (select min(price_cents) filter (where unit = 'day') from pricing_rules p where p.listing_id = l.id)
where l.organization_id = 'de000000-0000-0000-0000-000000000001';

select title, price_from_cents / 100 as euro_giorno from listings
where organization_id = 'de000000-0000-0000-0000-000000000001' order by title;
