-- KeyRent · dati di base (idempotenti). Valori commerciali provvisori: da confermare.

insert into public.inventory_sources (kind, name) values ('direct', 'KeyRent Direct') on conflict (name) do nothing;

insert into public.categories (slug, name_it, sort) values
  ('auto', 'Auto', 10), ('moto', 'Moto', 20), ('bici', 'Bici', 30), ('camper', 'Camper', 40),
  ('barche', 'Barche', 50), ('furgoni', 'Furgoni', 60), ('quad-motoslitte', 'Quad e motoslitte', 70)
on conflict (slug) do nothing;

insert into public.subcategories (category_id, slug, name_it, sort)
select c.id, s.slug, s.name_it, s.sort
from (values
  ('auto', 'city-car', 'City car', 10), ('auto', 'suv', 'SUV', 20), ('auto', 'berlina', 'Berlina', 30),
  ('auto', 'sportiva', 'Sportiva', 40), ('auto', 'cabrio', 'Cabrio', 50),
  ('moto', 'scooter', 'Scooter', 10), ('moto', 'naked', 'Naked', 20), ('moto', 'touring', 'Touring', 30),
  ('bici', 'city', 'City bike', 10), ('bici', 'e-bike', 'E-bike', 20), ('bici', 'mtb', 'Mountain bike', 30),
  ('bici', 'gravel', 'Gravel/strada', 40),
  ('camper', 'mansardato', 'Mansardato', 10), ('camper', 'semintegrale', 'Semintegrale', 20),
  ('camper', 'motorhome', 'Motorhome', 30), ('camper', 'van', 'Camper van', 40),
  ('barche', 'gommone', 'Gommone', 10), ('barche', 'barca-a-motore', 'Barca a motore', 20),
  ('barche', 'barca-a-vela', 'Barca a vela', 30), ('barche', 'senza-patente', 'Senza patente', 40),
  ('furgoni', 'van-merci', 'Furgone merci', 10), ('furgoni', 'minibus', 'Minibus 9 posti', 20),
  ('quad-motoslitte', 'quad', 'Quad', 10), ('quad-motoslitte', 'motoslitta', 'Motoslitta', 20)
) as s(cat, slug, name_it, sort)
join public.categories c on c.slug = s.cat
on conflict (category_id, slug) do nothing;

-- Attributi filtrabili per categoria (chiavi in inglese, etichette in italiano)
insert into public.attribute_definitions (category_id, key, label_it, data_type, unit, options, filterable, sort)
select c.id, a.key, a.label_it, a.data_type, a.unit, a.options::jsonb, a.filterable, a.sort
from (values
  ('auto', 'fuel', 'Alimentazione', 'enum', null, '["benzina","diesel","ibrida","elettrica","gpl","metano"]', true, 10),
  ('auto', 'gearbox', 'Cambio', 'enum', null, '["manuale","automatico"]', true, 20),
  ('auto', 'seats', 'Posti', 'number', null, null, true, 30),
  ('auto', 'doors', 'Porte', 'number', null, null, false, 40),
  ('auto', 'power_kw', 'Potenza', 'number', 'kW', null, false, 50),
  ('auto', 'displacement_cc', 'Cilindrata', 'number', 'cm³', null, false, 60),
  ('auto', 'drivetrain', 'Trazione', 'enum', null, '["anteriore","posteriore","integrale"]', true, 70),
  ('moto', 'license', 'Patente', 'enum', null, '["AM","A1","A2","A","B"]', true, 10),
  ('moto', 'displacement_cc', 'Cilindrata', 'number', 'cm³', null, true, 20),
  ('moto', 'power_kw', 'Potenza', 'number', 'kW', null, false, 30),
  ('bici', 'electric', 'Pedalata assistita', 'boolean', null, null, true, 10),
  ('bici', 'frame_size', 'Taglia telaio', 'enum', null, '["XS","S","M","L","XL"]', true, 20),
  ('camper', 'berths', 'Posti letto', 'number', null, null, true, 10),
  ('camper', 'travel_seats', 'Posti in marcia', 'number', null, null, true, 20),
  ('camper', 'gearbox', 'Cambio', 'enum', null, '["manuale","automatico"]', true, 30),
  ('camper', 'length_cm', 'Lunghezza', 'number', 'cm', null, false, 40),
  ('camper', 'pets_allowed', 'Animali ammessi', 'boolean', null, null, true, 50),
  ('barche', 'license_required', 'Patente nautica richiesta', 'boolean', null, null, true, 10),
  ('barche', 'max_people', 'Persone a bordo', 'number', null, null, true, 20),
  ('barche', 'length_cm', 'Lunghezza', 'number', 'cm', null, false, 30),
  ('barche', 'skipper', 'Skipper', 'enum', null, '["incluso","opzionale","non disponibile"]', true, 40),
  ('furgoni', 'load_m3', 'Volume di carico', 'number', 'm³', null, true, 10),
  ('furgoni', 'seats', 'Posti', 'number', null, null, true, 20),
  ('furgoni', 'license', 'Patente', 'enum', null, '["B","C1"]', true, 30)
) as a(cat, key, label_it, data_type, unit, options, filterable, sort)
join public.categories c on c.slug = a.cat
on conflict (category_id, key) do nothing;

-- Catalogo minimo di esempio (il catalogo completo si carica da import)
insert into public.makes (slug, name) values
  ('fiat', 'Fiat'), ('lamborghini', 'Lamborghini'), ('volkswagen', 'Volkswagen'), ('bmw', 'BMW'),
  ('ducati', 'Ducati'), ('piaggio', 'Piaggio'), ('adria', 'Adria'), ('laika', 'Laika'),
  ('bianchi', 'Bianchi'), ('cannondale', 'Cannondale'), ('ford', 'Ford'), ('zodiac', 'Zodiac')
on conflict (slug) do nothing;

insert into public.models (make_id, category_id, slug, name)
select mk.id, c.id, m.slug, m.name
from (values
  ('fiat', 'auto', 'panda', 'Panda'), ('fiat', 'auto', '500', '500'), ('lamborghini', 'auto', 'urus', 'Urus'),
  ('lamborghini', 'auto', 'huracan', 'Huracán'), ('volkswagen', 'auto', 'golf', 'Golf'),
  ('bmw', 'moto', 'r-1250-gs', 'R 1250 GS'), ('ducati', 'moto', 'monster', 'Monster'),
  ('piaggio', 'moto', 'liberty-125', 'Liberty 125'),
  ('adria', 'camper', 'coral', 'Coral'), ('laika', 'camper', 'kosmo', 'Kosmo'),
  ('volkswagen', 'camper', 'california', 'California'),
  ('bianchi', 'bici', 'e-omnia', 'E-Omnia'), ('cannondale', 'bici', 'topstone', 'Topstone'),
  ('ford', 'furgoni', 'transit', 'Transit'), ('fiat', 'furgoni', 'ducato', 'Ducato'),
  ('zodiac', 'barche', 'medline', 'Medline')
) as m(make, cat, slug, name)
join public.makes mk on mk.slug = m.make
join public.categories c on c.slug = m.cat
on conflict (make_id, category_id, slug) do nothing;

-- Policy di cancellazione standard, versione 1 (da validare legalmente prima del go-live)
insert into public.cancellation_policies (code, name) values ('standard', 'Standard KeyRent') on conflict (code) do nothing;
insert into public.cancellation_policy_versions (policy_id, version, rules, effective_from)
select p.id, 1, '{
  "before_confirmation_fee_pct": 0,
  "tiers": [
    {"min_hours_before": 168, "fee_pct": 10},
    {"min_hours_before": 48,  "fee_pct": 30},
    {"min_hours_before": 0,   "fee_pct": 50}
  ],
  "no_show_fee_pct": 100,
  "provider_cancel_refund_pct": 100
}'::jsonb, '2026-01-01'
from public.cancellation_policies p where p.code = 'standard'
on conflict (policy_id, version) do nothing;

-- Commissione globale provvisoria 5% (le regole per categoria si aggiungono quando decise)
insert into public.commission_rules (category_id, organization_id, rate_bps, min_fee_cents, valid_from)
select null, null, 500, 0, '2026-01-01'
where not exists (select 1 from public.commission_rules where category_id is null and organization_id is null);
