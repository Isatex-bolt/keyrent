-- Dati di test: due provider (A = camper + bici in pool, B = auto), clienti, staff.
\set ON_ERROR_STOP 1

create schema if not exists test;
create or replace function test.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;
-- verifica che uno statement fallisca con un messaggio/codice atteso
create or replace function test.fails(p_sql text, p_expect text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL: % (nessun errore, atteso "%")', p_msg, p_expect;
exception when others then
  if sqlerrm ilike '%FAIL:%' then raise; end if;
  if sqlerrm ~* p_expect or sqlstate = p_expect then
    raise notice 'ok - %', p_msg;
  else
    raise exception 'FAIL: % (errore "%" [%], atteso "%")', p_msg, sqlerrm, sqlstate, p_expect;
  end if;
end $$;
grant usage on schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@frattin.test'),
  ('a0000000-0000-0000-0000-000000000002', 'staff@frattin.test'),
  ('b0000000-0000-0000-0000-000000000001', 'owner@rentb.test'),
  ('c0000000-0000-0000-0000-000000000001', 'cliente1@test.it'),
  ('c0000000-0000-0000-0000-000000000002', 'cliente2@test.it'),
  ('d0000000-0000-0000-0000-000000000001', 'admin@keyrent.it'),
  ('d0000000-0000-0000-0000-000000000002', 'care@keyrent.it');
-- 20 clienti per il test di concorrenza
insert into auth.users (id, email)
select ('e0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'conc' || g || '@test.it'
from generate_series(1, 20) g;

insert into public.staff_members (user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', 'admin'),
  ('d0000000-0000-0000-0000-000000000002', 'customer_care');

insert into public.organizations (id, legal_name, trade_name, vat_number, verification_status, stripe_onboarding_status,
                                  stripe_account_id, business_phone, legal_address) values
  ('0a000000-0000-0000-0000-000000000001', 'Frattin Auto S.r.l.', 'Frattin Auto', 'IT01234567890', 'verified', 'complete',
   'acct_test_A', '+39 0424 000000', '{"street":"Via Roma 1","city":"Cassola","province":"VI"}'),
  ('0b000000-0000-0000-0000-000000000001', 'Rent B S.p.A.', 'Rent B', 'IT09876543210', 'verified', 'complete',
   'acct_test_B', '+39 049 000000', '{"street":"Via Padova 2","city":"Padova","province":"PD"}');

insert into public.organization_members (organization_id, user_id, role) values
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'staff'),
  ('0b000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner');

insert into public.locations (id, organization_id, name, address_line, postal_code, city, province, latitude, longitude,
                              phone, pickup_instructions) values
  ('1a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'Sede Padova',
   'Via Venezia 123', '35131', 'Padova', 'PD', 45.4170, 11.9030, '+39 333 1112233', 'Citofono Frattin, piano terra'),
  ('1b000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001', 'Rent B Vicenza',
   'Viale Milano 9', '36100', 'Vicenza', 'VI', 45.5455, 11.5354, '+39 0444 999999', 'Box 4');

-- Unità: A = 1 camper + 3 bici; B = 1 auto
insert into public.vehicle_units (id, organization_id, location_id, category_id, make_id, model_id, plate, label)
select u.id::uuid, u.org::uuid, u.loc::uuid, c.id, mk.id, md.id, u.plate, u.label
from (values
  ('2a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'camper', 'laika', 'kosmo', 'AB123CD', null),
  ('2a000000-0000-0000-0000-000000000011', '0a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'bici', 'bianchi', 'e-omnia', null, 'Bici #1'),
  ('2a000000-0000-0000-0000-000000000012', '0a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'bici', 'bianchi', 'e-omnia', null, 'Bici #2'),
  ('2a000000-0000-0000-0000-000000000013', '0a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'bici', 'bianchi', 'e-omnia', null, 'Bici #3'),
  ('2b000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'auto', 'lamborghini', 'urus', 'XY999ZZ', null)
) as u(id, org, loc, cat, make, model, plate, label)
join public.categories c on c.slug = u.cat
join public.makes mk on mk.slug = u.make
join public.models md on md.make_id = mk.id and md.slug = u.model;

insert into public.listings (id, organization_id, location_id, category_id, make_id, model_id, title, slug, description,
                             attributes, quantity_mode)
select l.id::uuid, l.org::uuid, l.loc::uuid, c.id, mk.id, md.id, l.title, l.slug,
       'Descrizione di prova sufficientemente lunga per superare la validazione minima.', l.attrs::jsonb, l.mode
from (values
  ('3a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001',
   'camper', 'laika', 'kosmo', 'Laika Kosmo 6 posti', 'laika-kosmo-6-posti', '{"berths":6,"gearbox":"manuale"}', 'single'),
  ('3a000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001',
   'bici', 'bianchi', 'e-omnia', 'E-bike Bianchi E-Omnia', 'e-bike-bianchi-e-omnia', '{"electric":true,"frame_size":"M"}', 'pool'),
  ('3b000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001',
   'auto', 'lamborghini', 'urus', 'Lamborghini Urus', 'lamborghini-urus', '{"fuel":"benzina","gearbox":"automatico","seats":5}', 'single')
) as l(id, org, loc, cat, make, model, title, slug, attrs, mode)
join public.categories c on c.slug = l.cat
join public.makes mk on mk.slug = l.make
join public.models md on md.make_id = mk.id and md.slug = l.model;

insert into public.listing_units (listing_id, vehicle_unit_id) values
  ('3a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001'),
  ('3a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000011'),
  ('3a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000012'),
  ('3a000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000013'),
  ('3b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001');

insert into public.rental_terms (listing_id, deposit_cents, min_duration_minutes, buffer_minutes, min_driver_age) values
  ('3a000000-0000-0000-0000-000000000001', 100000, 1440, 120, 25),
  ('3a000000-0000-0000-0000-000000000002', 5000, 60, 0, 14),
  ('3b000000-0000-0000-0000-000000000001', 500000, 1440, 60, 30);

insert into public.pricing_rules (listing_id, unit, price_cents) values
  ('3a000000-0000-0000-0000-000000000001', 'day', 25000),     -- camper €250/giorno
  ('3a000000-0000-0000-0000-000000000001', 'week', 150000),   -- €1.500/settimana
  ('3a000000-0000-0000-0000-000000000002', 'hour', 800),      -- bici €8/ora
  ('3a000000-0000-0000-0000-000000000002', 'half_day', 2500), -- €25 mezza giornata
  ('3a000000-0000-0000-0000-000000000002', 'day', 3500),      -- €35/giorno
  ('3b000000-0000-0000-0000-000000000001', 'day', 120000);    -- Urus €1.200/giorno

insert into public.listing_media (listing_id, storage_path, sort)
select l.id, 'listings/' || l.id || '/' || g || '.jpg', g
from public.listings l, generate_series(1, 4) g;

-- Workflow: invio in revisione dal provider, approvazione dello staff (→ pubblicato)
select private.listing_transition('3a000000-0000-0000-0000-000000000001', 'pending_review', 'a0000000-0000-0000-0000-000000000001');
select private.listing_transition('3a000000-0000-0000-0000-000000000002', 'pending_review', 'a0000000-0000-0000-0000-000000000001');
select private.listing_transition('3b000000-0000-0000-0000-000000000001', 'pending_review', 'b0000000-0000-0000-0000-000000000001');
select private.listing_transition('3a000000-0000-0000-0000-000000000001', 'approved', 'd0000000-0000-0000-0000-000000000001');
select private.listing_transition('3a000000-0000-0000-0000-000000000002', 'approved', 'd0000000-0000-0000-0000-000000000001');
select private.listing_transition('3b000000-0000-0000-0000-000000000001', 'approved', 'd0000000-0000-0000-0000-000000000001');

select test.ok((select count(*) from public.listings where status = 'published') = 3, 'fixture: 3 annunci pubblicati dal workflow');
