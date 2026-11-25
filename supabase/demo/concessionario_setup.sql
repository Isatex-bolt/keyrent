-- =====================================================================================
-- KeyRent · ACCOUNT DIMOSTRATIVO "concessionario@keyrent.it"
-- Prima: migrazione 0025 + utente creato da Authentication → Users → Add user (Auto Confirm).
-- Blocchi da eseguire in ordine nell'editor SQL di Supabase. Tutti rieseguibili.
-- =====================================================================================

-- ===== BLOCCO 1 · Cancella TUTTI gli annunci, le prenotazioni di prova e i vecchi dati demo =====
do $$
begin
  alter table ledger_entries disable trigger ledger_immutable;
  alter table booking_events disable trigger booking_events_immutable;
  delete from ledger_entries;
  delete from booking_events;
  delete from reviews;
  delete from refunds;
  delete from payments;
  delete from payouts;
  delete from unit_reservations;
  delete from conversations;            -- i messaggi se ne vanno con le conversazioni
  delete from bookings;
  delete from listings;                 -- foto, prezzi, condizioni, revisioni se ne vanno con l'annuncio
  delete from vehicle_units;
  delete from organizations where id = 'de000000-0000-0000-0000-000000000001';  -- vecchia org DEMO
  alter table ledger_entries enable trigger ledger_immutable;
  alter table booking_events enable trigger booking_events_immutable;
end $$;
select (select count(*) from listings) as annunci_rimasti, (select count(*) from bookings) as prenotazioni_rimaste;


-- ===== BLOCCO 2 · Attività dimostrativa, 3 sedi, clienti finti =====
do $$
declare
  u uuid; org uuid := 'dd000000-0000-0000-0000-000000000001'; c record; col text;
begin
  select id into u from auth.users where email = 'concessionario@keyrent.it';
  if u is null then
    raise exception 'Manca l''utente concessionario@keyrent.it: crealo da Authentication → Users → Add user → Create new user (spunta Auto Confirm User).';
  end if;
  update profiles set first_name = 'Marco', last_name = 'Demo', phone = '+39 000 0000000' where id = u;

  insert into organizations (id, kind, legal_name, trade_name, vat_number, verification_status, stripe_onboarding_status,
                             business_email, legal_address, inventory_source_id, response_window_minutes, created_by, is_demo)
  values (org, 'provider', 'Autonoleggio Dimostrativo S.r.l.', 'KeyRent Demo', 'IT00000000099', 'verified', 'complete',
          'concessionario@keyrent.it', '{"via":"Via Esempio 1","cap":"35131","citta":"Padova","provincia":"PD"}',
          (select id from inventory_sources where kind = 'direct' limit 1), 1440, u, true)
  on conflict (id) do update set legal_name = excluded.legal_name, trade_name = excluded.trade_name, is_demo = true,
                                 verification_status = 'verified';
  insert into organization_members (organization_id, user_id, role, status) values (org, u, 'owner', 'active')
  on conflict do nothing;

  insert into locations (id, organization_id, name, address_line, postal_code, city, province, latitude, longitude, pickup_instructions) values
    ('dd100000-0000-0000-0000-000000000001', org, 'Sede Padova', 'Via Esempio 1', '35131', 'Padova', 'PD', 45.4130, 11.9010,
     'Ufficio al piano terra, parcheggio clienti nel cortile.'),
    ('dd100000-0000-0000-0000-000000000002', org, 'Sede Cortina', 'Via Esempio 2', '32043', 'Cortina d''Ampezzo', 'BL', 46.5405, 12.1357,
     'Punto noleggio vicino alla partenza delle piste.'),
    ('dd100000-0000-0000-0000-000000000003', org, 'Sede Lago di Garda', 'Via Esempio 3', '25015', 'Desenzano del Garda', 'BS', 45.4692, 10.5402,
     'Pontile del porto turistico, chiedi in biglietteria.')
  on conflict (id) do nothing;

  -- 8 clienti finti (non possono accedere: nessuna password)
  for c in select * from (values
    ('dd900000-0000-0000-0000-000000000001'::uuid, 'giulia.bianchi@demo.keyrent.it', 'Giulia', 'Bianchi'),
    ('dd900000-0000-0000-0000-000000000002'::uuid, 'luca.ferrari@demo.keyrent.it', 'Luca', 'Ferrari'),
    ('dd900000-0000-0000-0000-000000000003'::uuid, 'martina.rossi@demo.keyrent.it', 'Martina', 'Rossi'),
    ('dd900000-0000-0000-0000-000000000004'::uuid, 'alessandro.conti@demo.keyrent.it', 'Alessandro', 'Conti'),
    ('dd900000-0000-0000-0000-000000000005'::uuid, 'sara.colombo@demo.keyrent.it', 'Sara', 'Colombo'),
    ('dd900000-0000-0000-0000-000000000006'::uuid, 'davide.ricci@demo.keyrent.it', 'Davide', 'Ricci'),
    ('dd900000-0000-0000-0000-000000000007'::uuid, 'elena.marino@demo.keyrent.it', 'Elena', 'Marino'),
    ('dd900000-0000-0000-0000-000000000008'::uuid, 'matteo.greco@demo.keyrent.it', 'Matteo', 'Greco')
  ) as x(id, email, fn, ln) loop
    insert into auth.users (id, email, raw_user_meta_data, created_at)
    values (c.id, c.email, jsonb_build_object('first_name', c.fn, 'last_name', c.ln, 'customer_kind', 'privato'), now())
    on conflict (id) do nothing;
    update profiles set first_name = c.fn, last_name = c.ln, rents_personally = true where id = c.id;
  end loop;
  -- campi che il sistema di accesso di Supabase vuole vuoti e non nulli (altrimenti l'elenco utenti si blocca)
  for col in select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'
             and column_name in ('confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
                                 'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token') loop
    execute format('update auth.users set %I = coalesce(%I, '''') where email like ''%%@demo.keyrent.it''', col, col);
  end loop;
  for col in select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'
             and column_name in ('aud', 'role') loop
    execute format('update auth.users set %I = coalesce(%I, ''authenticated'') where email like ''%%@demo.keyrent.it''', col, col);
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'instance_id') then
    execute 'update auth.users set instance_id = coalesce(instance_id, ''00000000-0000-0000-0000-000000000000'') where email like ''%@demo.keyrent.it''';
  end if;
end $$;
select legal_name, is_demo, (select count(*) from locations where organization_id = o.id) as sedi
from organizations o where id = 'dd000000-0000-0000-0000-000000000001';


-- ===== BLOCCO 3 · I 10 annunci di esempio =====
do $$
declare
  org uuid := 'dd000000-0000-0000-0000-000000000001'; s record; v_cat uuid; v_make uuid; v_model uuid; v_sub uuid;
  v_listing uuid; g integer;
begin
  for s in select * from (values
    (1, 1, 'auto', null, 'Fiat', '500', 'Fiat 500 Hybrid', 2024,
     '{"fuel":"ibrida","gearbox":"manuale","seats":4,"doors":3,"power_kw":51}', 1, 4500, 27000, null, 30000, true, true,
     'La city car più amata, in versione ibrida: consuma pochissimo, si parcheggia ovunque ed è perfetta per muoversi in città o per una gita sui Colli Euganei. Climatizzatore, Apple CarPlay e Android Auto, sensori di parcheggio.'),
    (2, 1, 'auto', null, 'BMW', 'X3', 'BMW X3 xDrive20d', 2024,
     '{"fuel":"diesel","gearbox":"automatico","seats":5,"doors":5,"power_kw":145,"drivetrain":"integrale"}', 1, 12000, 72000, null, 100000, false, true,
     'SUV premium a trazione integrale, cambio automatico e tanto spazio per bagagli e sci. Ideale per viaggi di lavoro e vacanze in montagna. Navigatore, cruise control adattivo, portellone elettrico.'),
    (3, 1, 'moto', null, 'Ducati', 'Multistrada V4', 'Ducati Multistrada V4', 2024,
     '{"license":"A","displacement_cc":1158,"power_kw":125}', 1, 16000, 95000, null, 150000, false, false,
     'La crossover sportiva per eccellenza: comoda nei lunghi viaggi, scatenata tra i tornanti delle Dolomiti. Borse laterali e due caschi su richiesta.'),
    (4, 1, 'moto', null, 'Piaggio', 'Vespa Primavera', 'Vespa Primavera 125', 2024,
     '{"license":"A1","displacement_cc":125,"power_kw":8}', 1, 4500, 25000, null, 30000, false, false,
     'L''icona italiana su due ruote: leggera, elegante e facilissima da guidare. Bauletto e casco inclusi, perfetta per scoprire la città.'),
    (5, 3, 'bici', null, 'Specialized', 'Turbo Vado', 'E-bike Specialized Turbo Vado', 2025,
     '{"electric":true,"frame_size":"M"}', 6, 3900, null, 900, 5000, false, false,
     'Bici a pedalata assistita con autonomia fino a 90 km: la ciclabile del lungolago diventa una passeggiata. Casco, lucchetto e borsa inclusi. Sei bici disponibili, anche per gruppi.'),
    (6, 1, 'camper', null, 'Adria', 'Matrix Plus', 'Camper Adria Matrix Plus 670', 2023,
     '{"berths":5,"travel_seats":4,"gearbox":"manuale","length_cm":699,"pets_allowed":true}', 1, 17000, 105000, null, 100000, false, false,
     'Semintegrale con letto basculante e dinette trasformabile: cucina completa, bagno con doccia separata, pannello solare e portabici. Animali benvenuti.'),
    (7, 3, 'barche', null, 'Joker Boat', 'Clubman 19', 'Gommone Joker Boat Clubman 19', 2023,
     '{"license_required":false,"max_people":7,"length_cm":580,"skipper":"opzionale"}', 1, 25000, null, 6500, 50000, false, false,
     'Gommone senza patente con prendisole a prua: il modo più bello per raggiungere le spiagge del Garda. Dotazioni di sicurezza a bordo, carburante a consumo.'),
    (8, 1, 'furgoni', null, 'Fiat', 'Ducato', 'Furgone Fiat Ducato 13 m³', 2024,
     '{"load_m3":13,"seats":3,"license":"B"}', 1, 8500, 49000, 2500, 50000, true, true,
     'Furgone grande per traslochi e trasporti: vano da 13 m³, porta laterale scorrevole e cinghie incluse. Si guida con la patente B.'),
    (9, 2, 'quad-motoslitte', 'quad', 'Polaris', 'Sportsman 570', 'Quad Polaris Sportsman 570', 2024,
     '{}', 1, 14000, null, 4500, 80000, false, false,
     'Quad 4x4 per esplorare i sentieri autorizzati intorno a Cortina, d''estate e d''inverno. Casco e briefing di sicurezza inclusi.'),
    (10, 2, 'quad-motoslitte', 'motoslitta', 'Ski-Doo', 'Summit', 'Motoslitta Ski-Doo Summit', 2024,
     '{}', 1, 22000, null, 7000, 150000, false, false,
     'Motoslitta da neve fresca per le aree dedicate: un''emozione unica sulle Dolomiti. Abbigliamento tecnico e casco su richiesta.')
  ) as x(n, loc, cat, sub, make, model, title, year, attrs, units, day, week, hour, deposit, delivery, lt, descr)
  loop
    v_listing := ('dd200000-0000-0000-0000-' || lpad(s.n::text, 12, '0'))::uuid;
    select id into v_cat from categories where slug = s.cat;
    select id into v_sub from subcategories where category_id = v_cat and slug = s.sub;
    insert into makes (slug, name) values (lower(regexp_replace(s.make, '[^A-Za-z0-9]+', '-', 'g')), s.make)
      on conflict (slug) do update set name = makes.name returning id into v_make;
    insert into models (make_id, category_id, slug, name)
      values (v_make, v_cat, lower(regexp_replace(s.model, '[^A-Za-z0-9]+', '-', 'g')), s.model)
      on conflict (make_id, category_id, slug) do update set name = models.name returning id into v_model;

    insert into listings (id, organization_id, location_id, category_id, subcategory_id, make_id, model_id, title, slug, description,
                          attributes, quantity_mode, status, published_at, demo_keep, created_at)
    values (v_listing, org, ('dd100000-0000-0000-0000-00000000000' || s.loc)::uuid, v_cat, v_sub, v_make, v_model, s.title,
            lower(regexp_replace(s.title, '[^A-Za-z0-9]+', '-', 'g')), s.descr, s.attrs::jsonb,
            case when s.units > 1 then 'pool' else 'single' end, 'published', now(), true, now() - make_interval(mins => 11 - s.n))
    on conflict (id) do nothing;

    for g in 1 .. s.units loop
      insert into vehicle_units (id, organization_id, location_id, category_id, make_id, model_id, label, year)
      values (('dd3000' || lpad(s.n::text, 2, '0') || '-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, org,
              ('dd100000-0000-0000-0000-00000000000' || s.loc)::uuid, v_cat, v_make, v_model,
              case when s.units > 1 then 'Bici #' || g end, s.year)
      on conflict (id) do nothing;
      insert into listing_units (listing_id, vehicle_unit_id)
      values (v_listing, ('dd3000' || lpad(s.n::text, 2, '0') || '-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid)
      on conflict do nothing;
    end loop;

    insert into rental_terms (listing_id, deposit_cents, min_duration_minutes, buffer_minutes, min_driver_age, included_km_per_day,
                              extra_km_cents, fuel_policy, delivery_enabled, delivery_radius_km, delivery_fee_cents, delivery_per_km_cents,
                              long_term_enabled, lt_prices, lt_services, lt_km_per_year, lt_extra_km_cents)
    values (v_listing, s.deposit, case when s.hour is not null then 60 else 1440 end, case when s.cat = 'camper' then 120 else 30 end,
            case s.cat when 'auto' then case when s.day > 10000 then 25 else 21 end when 'camper' then 25 when 'moto' then case when s.day > 10000 then 24 else 16 end
                       when 'furgoni' then 21 when 'quad-motoslitte' then 18 else 14 end,
            case when s.cat in ('auto', 'camper', 'furgoni', 'moto') then 250 end,
            case when s.cat in ('auto', 'camper', 'furgoni', 'moto') then 25 end,
            case when s.cat in ('auto', 'camper', 'furgoni', 'moto', 'barche', 'quad-motoslitte') then 'pieno/pieno' end,
            s.delivery, case when s.delivery then 30 end, case when s.delivery then 1500 else 0 end, case when s.delivery then 90 else 0 end,
            s.lt,
            case when s.n = 1 then '{"12":32900,"24":29900,"36":27900,"48":26900}' when s.n = 2 then '{"12":69900,"24":64900,"36":59900,"48":57900}'
                 when s.n = 8 then '{"12":54900,"24":49900,"36":46900,"48":44900}' else '{}' end::jsonb,
            case when s.lt then '{"bollo":{"offered":true,"cents":0},"assicurazione":{"offered":true,"cents":0},"tagliandi":{"offered":true,"cents":0},"gomme":{"offered":true,"cents":2500},"sostitutiva":{"offered":true,"cents":1500}}' else '{}' end::jsonb,
            case when s.lt then 15000 end, case when s.lt then 12 end)
    on conflict (listing_id) do nothing;

    insert into pricing_rules (listing_id, unit, price_cents)
    select v_listing, u.unit::price_unit, u.price
    from (values ('day', s.day), ('week', s.week), ('hour', s.hour)) as u(unit, price)
    where u.price is not null and not exists (select 1 from pricing_rules p where p.listing_id = v_listing);
  end loop;

  insert into extras (listing_id, name, price_cents, charge, max_qty)
  select x.l, x.name, x.p, x.charge, x.q from (values
    ('dd200000-0000-0000-0000-000000000001'::uuid, 'Seggiolino bambini', 500, 'per_day', 2),
    ('dd200000-0000-0000-0000-000000000002'::uuid, 'Portasci sul tetto', 800, 'per_day', 1),
    ('dd200000-0000-0000-0000-000000000003'::uuid, 'Borse laterali', 1000, 'per_day', 1),
    ('dd200000-0000-0000-0000-000000000006'::uuid, 'Kit pulizia finale', 6000, 'per_rental', 1),
    ('dd200000-0000-0000-0000-000000000008'::uuid, 'Carrello portapacchi', 1500, 'per_day', 1)
  ) as x(l, name, p, charge, q)
  where not exists (select 1 from extras e where e.listing_id = x.l);

  update listings l set price_from_cents = (select min(price_cents) filter (where unit = 'day') from pricing_rules p where p.listing_id = l.id)
   where l.organization_id = org;
end $$;
select title, price_from_cents / 100 as euro_giorno from listings
where organization_id = 'dd000000-0000-0000-0000-000000000001' order by created_at;


-- ===== BLOCCO 4 · Noleggi finti (passati, in corso, futuri, richieste) =====
select private.demo_reset() as risultato;
