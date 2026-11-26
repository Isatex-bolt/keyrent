-- =====================================================================================
-- KeyRent · DEMO SELECT: 6 annunci esclusivi (NCC, Ferrari, Lamborghini, Porsche, Jet, Elicottero)
-- Prima: migrazioni 0028, 0029, 0030, 0031 e il setup concessionario. Rieseguibile.
-- =====================================================================================
do $$
declare
  org uuid := 'dd000000-0000-0000-0000-000000000001'; s record; v_cat uuid; v_make uuid; v_model uuid; v_listing uuid; v_unit uuid;
begin
  insert into locations (id, organization_id, name, address_line, postal_code, city, province, latitude, longitude, pickup_instructions) values
    ('dd100000-0000-0000-0000-000000000004', org, 'Sede Milano', 'Via Esempio 4', '20121', 'Milano', 'MI', 45.4720, 9.1890,
     'Showroom con parcheggio riservato: ti accogliamo con un caffè e una spiegazione completa del mezzo.'),
    ('dd100000-0000-0000-0000-000000000005', org, 'Milano Linate · Aviazione generale', 'Viale Enrico Forlanini', '20054', 'Segrate', 'MI', 45.4495, 9.2783,
     'Terminal Aviazione generale (Prime): imbarco riservato, accesso in auto fino all''aereo.')
  on conflict (id) do nothing;

  for s in select * from (values
    (11, 4, 'ncc', 'Mercedes-Benz', 'Vito Tourer', 'Mercedes-Benz Vito Tourer nero · NCC con autista', 2025, '{"seats":8}',
     8500, 65000, null, 0, null, false,
     'Van executive nero nuovo con autista professionista in giacca e cravatta. Transfer da e per Linate, Malpensa e Bergamo, eventi, fiere e serate in città. Fino a 7 passeggeri con bagagli, sedili in pelle, Wi-Fi, acqua e prese USB a bordo.'),
    (12, 4, 'auto', 'Ferrari', '296 GTB', 'Ferrari 296 GTB', 2024, '{"fuel":"ibrida","gearbox":"automatico","seats":2,"doors":2,"power_kw":610}',
     null, 180000, 1100000, 1000000, 30, true,
     'V6 ibrido da 830 CV: la berlinetta Ferrari più emozionante degli ultimi anni. Consegna in showroom con spiegazione completa, oppure a domicilio o in hotel. 150 km al giorno inclusi.'),
    (13, 4, 'auto', 'Lamborghini', 'Huracan EVO', 'Lamborghini Huracán EVO', 2023, '{"fuel":"benzina","gearbox":"automatico","seats":2,"doors":2,"power_kw":470,"drivetrain":"integrale"}',
     null, 150000, 900000, 1000000, 30, true,
     'V10 aspirato da 640 CV e trazione integrale: il suono che fa girare tutti. Perfetta per un weekend sul lago di Como o un evento speciale. 150 km al giorno inclusi.'),
    (14, 4, 'auto', 'Porsche', '911 GT3 RS', 'Porsche 911 GT3 RS', 2024, '{"fuel":"benzina","gearbox":"automatico","seats":2,"doors":2,"power_kw":386}',
     null, 120000, 750000, 800000, 30, true,
     'La 911 più estrema omologata per la strada, nata in pista: 525 CV, aerodinamica attiva, cambio PDK. Per chi vuole guidare davvero. 150 km al giorno inclusi.'),
    (15, 5, 'jet', 'Embraer', 'Phenom 300E', 'Jet privato Embraer Phenom 300E', 2022, '{"seats":8}',
     450000, 2400000, null, 0, null, false,
     'Jet leggero da 8 passeggeri, il più venduto al mondo nella sua classe. Da Milano Linate a Parigi, Londra, Ibiza o Olbia in meno di due ore. Due piloti, assistenza a terra e imbarco riservato inclusi; catering su richiesta.'),
    (16, 2, 'elicotteri', 'Leonardo', 'AW109 Trekker', 'Elicottero Leonardo AW109 Trekker', 2021, '{"seats":6}',
     220000, 1200000, null, 0, null, false,
     'Bimotore italiano da 6 passeggeri con pilota: voli panoramici sulle Dolomiti, transfer da Cortina a Venezia o Milano in meno di un''ora, matrimoni ed eventi.')
  ) as x(n, loc, cat, make, model, title, year, attrs, hour, day, week, deposit, age, delivery, descr)
  loop
    v_listing := ('dd200000-0000-0000-0000-' || lpad(s.n::text, 12, '0'))::uuid;
    v_unit := ('dd3000' || lpad(s.n::text, 2, '0') || '-0000-0000-0000-000000000001')::uuid;
    select id into v_cat from categories where slug = s.cat;
    insert into makes (slug, name) values (lower(regexp_replace(s.make, '[^A-Za-z0-9]+', '-', 'g')), s.make)
      on conflict (slug) do update set name = makes.name returning id into v_make;
    insert into models (make_id, category_id, slug, name)
      values (v_make, v_cat, lower(regexp_replace(s.model, '[^A-Za-z0-9]+', '-', 'g')), s.model)
      on conflict (make_id, category_id, slug) do update set name = models.name returning id into v_model;

    insert into listings (id, organization_id, location_id, category_id, make_id, model_id, title, slug, description,
                          attributes, quantity_mode, status, published_at, demo_keep, is_select, created_at)
    values (v_listing, org, ('dd100000-0000-0000-0000-00000000000' || s.loc)::uuid, v_cat, v_make, v_model, s.title,
            lower(regexp_replace(s.title, '[^A-Za-z0-9]+', '-', 'g')), s.descr, s.attrs::jsonb,
            'single', 'published', now(), true, true, now() - make_interval(mins => 30 - s.n))
    on conflict (id) do update set title = excluded.title, description = excluded.description, is_select = true, demo_keep = true;

    insert into vehicle_units (id, organization_id, location_id, category_id, make_id, model_id, year)
    values (v_unit, org, ('dd100000-0000-0000-0000-00000000000' || s.loc)::uuid, v_cat, v_make, v_model, s.year)
    on conflict (id) do nothing;
    insert into listing_units (listing_id, vehicle_unit_id) values (v_listing, v_unit) on conflict do nothing;

    insert into rental_terms (listing_id, deposit_cents, min_duration_minutes, buffer_minutes, min_driver_age, min_license_years,
                              included_km_per_day, extra_km_cents, fuel_policy,
                              delivery_enabled, delivery_radius_km, delivery_fee_cents, delivery_per_km_cents)
    values (v_listing, s.deposit, case when s.hour is not null then 60 else 1440 end, 60, s.age, case when s.age is not null then 5 end,
            case when s.cat = 'auto' then 150 end, case when s.cat = 'auto' then 300 end, case when s.cat = 'auto' then 'pieno/pieno' end,
            s.delivery, case when s.delivery then 80 end, case when s.delivery then 15000 else 0 end, case when s.delivery then 250 else 0 end)
    on conflict (listing_id) do nothing;

    insert into pricing_rules (listing_id, unit, price_cents)
    select v_listing, u.unit::price_unit, u.price
    from (values ('hour', s.hour), ('day', s.day), ('week', s.week)) as u(unit, price)
    where u.price is not null and not exists (select 1 from pricing_rules p where p.listing_id = v_listing);

    update listings set price_from_cents = coalesce(s.hour, s.day) where id = v_listing;
  end loop;

  insert into extras (listing_id, name, price_cents, charge, max_qty)
  select x.l, x.name, x.p, x.charge, x.q from (values
    ('dd200000-0000-0000-0000-000000000011'::uuid, 'Seggiolino bambini', 1000, 'per_rental', 2),
    ('dd200000-0000-0000-0000-000000000012'::uuid, 'Secondo guidatore', 5000, 'per_day', 1),
    ('dd200000-0000-0000-0000-000000000013'::uuid, 'Secondo guidatore', 5000, 'per_day', 1),
    ('dd200000-0000-0000-0000-000000000015'::uuid, 'Catering gourmet a bordo', 60000, 'per_rental', 1),
    ('dd200000-0000-0000-0000-000000000016'::uuid, 'Video ricordo del volo', 15000, 'per_rental', 1)
  ) as x(l, name, p, charge, q)
  where not exists (select 1 from extras e where e.listing_id = x.l);
end $$;

-- noleggi e recensioni finti anche per i nuovi annunci
select private.demo_reset() as risultato;
select title, is_select, price_from_cents / 100 as da_euro from listings
where organization_id = 'dd000000-0000-0000-0000-000000000001' and is_select order by created_at;
