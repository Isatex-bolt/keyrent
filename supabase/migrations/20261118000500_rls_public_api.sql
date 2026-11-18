-- KeyRent · 0005 · Autorizzazioni (RLS + privilegi di colonna), viste pubbliche, ricerca
-- Principio: nessun accesso di default. Si concede solo ciò che serve, e RLS filtra le righe.

-- ---------------------------------------------------------------------------
-- Helper di autorizzazione (security definer: leggono membership senza ricorsione RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_staff(p_roles public.staff_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_members s
                  where s.user_id = auth.uid() and s.active
                    and (p_roles is null or s.role = any (p_roles)))
$$;

create or replace function private.is_org_member(p_org uuid, p_roles public.org_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m
                  where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
                    and (p_roles is null or m.role = any (p_roles)))
$$;

create or replace function private.listing_org(p_listing uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from listings where id = p_listing
$$;

create or replace function private.unit_org(p_unit uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from vehicle_units where id = p_unit
$$;

grant execute on function private.is_staff(public.staff_role[]), private.is_org_member(uuid, public.org_role[]),
                          private.listing_org(uuid), private.unit_org(uuid)
  to authenticated, anon;

-- Le funzioni di dominio in private sono riservate al server
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(public.staff_role[]), private.is_org_member(uuid, public.org_role[]),
                          private.listing_org(uuid), private.unit_org(uuid)
  to authenticated, anon;
grant execute on all functions in schema private to service_role;

-- ---------------------------------------------------------------------------
-- Si parte da zero privilegi su tutte le tabelle per i ruoli client
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- service_role ha BYPASSRLS in Supabase e viene usato solo dal server, dentro le funzioni del core.
-- Le viste e le funzioni security definer girano come owner (postgres), che non è soggetto a RLS
-- (per questo non usiamo FORCE ROW LEVEL SECURITY).

-- ---------------------------------------------------------------------------
-- Profili: solo il proprio. Staff in lettura.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, locale, birth_date, driving_license_since) on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Staff: ognuno vede il proprio ruolo, l'admin tutti. Scritture solo server.
grant select on public.staff_members to authenticated;
create policy staff_read on public.staff_members for select to authenticated
  using (user_id = auth.uid() or private.is_staff(array['admin']::staff_role[]));

-- ---------------------------------------------------------------------------
-- Organizzazioni e membri
-- ---------------------------------------------------------------------------
grant select on public.organizations to authenticated;
-- l'owner modifica solo i dati anagrafici, mai verifica, Stripe, fonte inventario
grant update (trade_name, tax_code, sdi_code, pec, legal_address, business_email, business_phone, website,
              response_window_minutes)
  on public.organizations to authenticated;
create policy org_read on public.organizations for select to authenticated
  using (private.is_org_member(id) or private.is_staff());
create policy org_update on public.organizations for update to authenticated
  using (private.is_org_member(id, array['owner']::org_role[]))
  with check (private.is_org_member(id, array['owner']::org_role[]));

grant select on public.organization_members to authenticated;
create policy members_read on public.organization_members for select to authenticated
  using (user_id = auth.uid() or private.is_org_member(organization_id) or private.is_staff());

-- Creazione organizzazione: chi la crea ne diventa owner, in modo atomico
create or replace function public.create_organization(p_legal_name text, p_vat text, p_trade_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  insert into organizations (legal_name, vat_number, trade_name, created_by,
                             inventory_source_id)
  values (p_legal_name, upper(replace(p_vat, ' ', '')), p_trade_name, v_user,
          (select id from inventory_sources where kind = 'direct' order by created_at limit 1))
  returning id into v_org;
  insert into organization_members (organization_id, user_id, role) values (v_org, v_user, 'owner');
  perform private.audit(v_user, 'user', 'organization', v_org, 'create');
  return v_org;
end $$;
revoke execute on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sedi, mezzi, annunci e figli: isolamento per organizzazione
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.locations to authenticated;
create policy loc_read on public.locations for select to authenticated
  using (private.is_org_member(organization_id) or private.is_staff());
create policy loc_write on public.locations for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));
create policy loc_update on public.locations for update to authenticated
  using (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]))
  with check (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));
create policy loc_delete on public.locations for delete to authenticated
  using (private.is_org_member(organization_id, array['owner']::org_role[]));

grant select, insert, update, delete on public.vehicle_units to authenticated;
create policy units_read on public.vehicle_units for select to authenticated
  using (private.is_org_member(organization_id) or private.is_staff());
create policy units_insert on public.vehicle_units for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));
create policy units_update on public.vehicle_units for update to authenticated
  using (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]))
  with check (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));
create policy units_delete on public.vehicle_units for delete to authenticated
  using (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));

-- listings: stato, revisione pubblicata, prezzo denormalizzato e date di pubblicazione NON scrivibili dal client
grant select, delete on public.listings to authenticated;
grant insert (organization_id, location_id, category_id, subcategory_id, make_id, model_id, version_id,
              title, slug, description, attributes, quantity_mode, instant_book)
  on public.listings to authenticated;
grant update (location_id, category_id, subcategory_id, make_id, model_id, version_id,
              title, slug, description, attributes, quantity_mode, instant_book)
  on public.listings to authenticated;
create policy listings_read on public.listings for select to authenticated
  using (private.is_org_member(organization_id) or private.is_staff());
create policy listings_insert on public.listings for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));
create policy listings_update on public.listings for update to authenticated
  using (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]))
  with check (private.is_org_member(organization_id, array['owner', 'manager']::org_role[]));
create policy listings_delete on public.listings for delete to authenticated
  using (private.is_org_member(organization_id, array['owner']::org_role[]) and status = 'draft');

-- Tabelle figlie di listing: la policy risale all'organizzazione dell'annuncio
do $$
declare t text;
begin
  foreach t in array array['listing_units', 'listing_media', 'rental_terms', 'pricing_rules', 'extras'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %1$s_read on public.%1$I for select to authenticated
      using (private.is_org_member(private.listing_org(listing_id)) or private.is_staff())$p$, t);
    execute format($p$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (private.is_org_member(private.listing_org(listing_id), array['owner','manager']::org_role[]))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$I for update to authenticated
      using (private.is_org_member(private.listing_org(listing_id), array['owner','manager']::org_role[]))
      with check (private.is_org_member(private.listing_org(listing_id), array['owner','manager']::org_role[]))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (private.is_org_member(private.listing_org(listing_id), array['owner','manager']::org_role[]))$p$, t);
  end loop;
end $$;
-- lo stato di moderazione delle foto non è scrivibile dal client
revoke update on public.listing_media from authenticated;
grant update (sort, alt) on public.listing_media to authenticated;

grant select on public.listing_revisions to authenticated;
create policy revisions_read on public.listing_revisions for select to authenticated
  using (private.is_org_member(private.listing_org(listing_id)) or private.is_staff());

-- ---------------------------------------------------------------------------
-- Catalogo, policy di cancellazione, fonti: lettura pubblica, scrittura solo server
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories', 'subcategories', 'makes', 'models', 'versions', 'attribute_definitions',
                           'cancellation_policies', 'cancellation_policy_versions'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %1$s_public_read on public.%1$I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

grant select on public.commission_rules to authenticated;
create policy commission_read on public.commission_rules for select to authenticated
  using (private.is_staff(array['admin', 'accounting']::staff_role[])
         or (organization_id is not null and private.is_org_member(organization_id, array['owner']::org_role[])));

grant select on public.inventory_sources to authenticated;
create policy sources_read on public.inventory_sources for select to authenticated using (private.is_staff());

-- ---------------------------------------------------------------------------
-- Prenotazioni: lettura per cliente, membri del provider, staff. Nessuna scrittura dal client.
-- ---------------------------------------------------------------------------
grant select on public.bookings to authenticated;
create policy bookings_read on public.bookings for select to authenticated
  using (customer_id = auth.uid() or private.is_org_member(organization_id) or private.is_staff());

grant select on public.booking_events to authenticated;
create policy booking_events_read on public.booking_events for select to authenticated
  using (exists (select 1 from bookings b where b.id = booking_id
                   and (b.customer_id = auth.uid() or private.is_org_member(b.organization_id) or private.is_staff())));

-- Disponibilità: il provider vede le proprie righe e gestisce solo blocchi/manutenzioni
grant select, insert on public.unit_reservations to authenticated;
grant update (active, note) on public.unit_reservations to authenticated;
create policy res_read on public.unit_reservations for select to authenticated
  using (private.is_org_member(private.unit_org(vehicle_unit_id)) or private.is_staff());
create policy res_block_insert on public.unit_reservations for insert to authenticated
  with check (kind in ('block', 'maintenance') and booking_id is null
              and private.is_org_member(private.unit_org(vehicle_unit_id), array['owner', 'manager']::org_role[]));
create policy res_block_update on public.unit_reservations for update to authenticated
  using (kind in ('block', 'maintenance')
         and private.is_org_member(private.unit_org(vehicle_unit_id), array['owner', 'manager']::org_role[]))
  with check (kind in ('block', 'maintenance'));

-- ---------------------------------------------------------------------------
-- Denaro: solo lettura e solo per chi ne ha titolo
-- ---------------------------------------------------------------------------
grant select on public.payments to authenticated;
create policy payments_read on public.payments for select to authenticated
  using (exists (select 1 from bookings b where b.id = booking_id
                   and (b.customer_id = auth.uid()
                        or private.is_org_member(b.organization_id, array['owner']::org_role[])))
         or private.is_staff(array['admin', 'accounting', 'customer_care']::staff_role[]));

grant select on public.refunds to authenticated;
create policy refunds_read on public.refunds for select to authenticated
  using (exists (select 1 from bookings b where b.id = booking_id
                   and (b.customer_id = auth.uid()
                        or private.is_org_member(b.organization_id, array['owner']::org_role[])))
         or private.is_staff(array['admin', 'accounting', 'customer_care']::staff_role[]));

grant select on public.payouts to authenticated;
create policy payouts_read on public.payouts for select to authenticated
  using (private.is_org_member(organization_id, array['owner']::org_role[])
         or private.is_staff(array['admin', 'accounting']::staff_role[]));

grant select on public.ledger_entries to authenticated;
create policy ledger_read on public.ledger_entries for select to authenticated
  using (private.is_staff(array['admin', 'accounting']::staff_role[])
         or (organization_id is not null and private.is_org_member(organization_id, array['owner']::org_role[])));

grant select on public.stripe_events to authenticated;
create policy stripe_events_read on public.stripe_events for select to authenticated
  using (private.is_staff(array['admin', 'accounting']::staff_role[]));

grant select on public.audit_log to authenticated;
create policy audit_read on public.audit_log for select to authenticated
  using (private.is_staff(array['admin', 'operations']::staff_role[]));

-- ---------------------------------------------------------------------------
-- Messaggi: i partecipanti NON vedono il testo originale (colonna esclusa)
-- ---------------------------------------------------------------------------
grant select on public.conversations to authenticated;
create policy conv_read on public.conversations for select to authenticated
  using (customer_id = auth.uid() or private.is_org_member(organization_id) or private.is_staff());

grant select (id, conversation_id, sender_id, sender_side, body_shown, filter_result, created_at)
  on public.messages to authenticated;
create policy messages_read on public.messages for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id
                   and (c.customer_id = auth.uid() or private.is_org_member(c.organization_id) or private.is_staff())));

grant execute on function public.start_conversation(uuid, text), public.send_message(uuid, text),
                          public.leave_review(uuid, smallint, text) to authenticated;
revoke execute on function public.start_conversation(uuid, text), public.send_message(uuid, text),
                           public.leave_review(uuid, smallint, text) from anon, public;

-- Notifiche: le proprie, si può solo segnare come lette
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.email_deliveries to authenticated;
create policy email_read on public.email_deliveries for select to authenticated
  using (private.is_staff(array['admin', 'operations', 'customer_care']::staff_role[]));

-- Preferiti
grant select, insert, delete on public.favorites to authenticated;
create policy fav_all on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Recensioni: pubbliche se pubblicate
grant select on public.reviews to anon, authenticated;
create policy reviews_public on public.reviews for select to anon, authenticated using (published);

-- ---------------------------------------------------------------------------
-- Vista pubblica degli annunci: solo campi pubblici, nessun dato del provider,
-- posizione arrotondata (~1 km). È l'unico modo in cui anon vede un annuncio.
-- ---------------------------------------------------------------------------
create view public.public_listings with (security_barrier = true) as
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
where l.status = 'published';

create view public.public_listing_media with (security_barrier = true) as
select m.id, m.listing_id, m.storage_path, m.sort, m.alt
from listing_media m
join listings l on l.id = m.listing_id
where l.status = 'published' and m.moderation_status = 'approved';

create view public.public_listing_prices with (security_barrier = true) as
select p.listing_id, p.unit, p.price_cents, p.valid_from, p.valid_to
from pricing_rules p join listings l on l.id = p.listing_id where l.status = 'published';

create view public.public_listing_extras with (security_barrier = true) as
select e.id, e.listing_id, e.name, e.price_cents, e.charge, e.max_qty
from extras e join listings l on l.id = e.listing_id where l.status = 'published';

-- Supabase concede per default tutti i privilegi sui nuovi oggetti: lasciamo solo la lettura
revoke all on public.public_listings, public.public_listing_media, public.public_listing_prices,
              public.public_listing_extras from anon, authenticated;
grant select on public.public_listings, public.public_listing_media, public.public_listing_prices,
                public.public_listing_extras to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ricerca server-side: categoria/marca/modello facoltativi, filtri attributi, prezzo, distanza,
-- disponibilità reale nelle date. Paginata.
-- ---------------------------------------------------------------------------
create or replace function public.search_listings(
  p_lat double precision default null, p_lng double precision default null, p_radius_km integer default 30,
  p_pickup timestamptz default null, p_return timestamptz default null,
  p_category text default null, p_make text default null, p_model text default null,
  p_filters jsonb default '{}'::jsonb, p_price_max_cents integer default null,
  p_sort text default 'relevance', p_limit integer default 24, p_offset integer default 0
) returns table (
  id uuid, slug text, title text, category_slug text, make_name text, model_name text,
  city text, province char(2), approx_latitude double precision, approx_longitude double precision,
  price_from_cents integer, distance_km numeric, available_units bigint, total_count bigint
) language sql stable security definer set search_path = public as $$
  with base as (
    select pl.*, l.location_id,
           case when p_lat is null then null
                else round((earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(loc.latitude, loc.longitude)) / 1000)::numeric, 1)
           end as dist
    from public_listings pl
    join listings l on l.id = pl.id
    join locations loc on loc.id = l.location_id
    where (p_category is null or pl.category_slug = p_category)
      and (p_make is null or pl.make_slug = p_make)
      and (p_model is null or pl.model_slug = p_model)
      and (p_price_max_cents is null or pl.price_from_cents <= p_price_max_cents)
      and (p_filters is null or p_filters = '{}'::jsonb or pl.attributes @> p_filters)
      and (p_lat is null or earth_box(ll_to_earth(p_lat, p_lng), p_radius_km * 1000) @> ll_to_earth(loc.latitude, loc.longitude))
  ), avail as (
    select b.*,
      (select count(*) from listing_units lu join vehicle_units vu on vu.id = lu.vehicle_unit_id
        where lu.listing_id = b.id and vu.operational_status = 'active'
          and (p_pickup is null or not exists (
                select 1 from unit_reservations r
                 where r.vehicle_unit_id = vu.id and r.active
                   and (r.kind <> 'hold' or r.expires_at > now())
                   and r.period && tstzrange(p_pickup, p_return, '[)')))) as free_units
    from base b
    where p_lat is null or b.dist <= p_radius_km
  )
  select a.id, a.slug, a.title, a.category_slug, a.make_name, a.model_name, a.city, a.province,
         a.approx_latitude, a.approx_longitude, a.price_from_cents, a.dist, a.free_units,
         count(*) over () as total_count
  from avail a
  where a.free_units > 0
  order by
    case when p_sort = 'price_asc' then a.price_from_cents end asc nulls last,
    case when p_sort = 'price_desc' then a.price_from_cents end desc nulls last,
    case when p_sort = 'distance' then a.dist end asc nulls last,
    a.published_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;
grant execute on function public.search_listings(double precision, double precision, integer, timestamptz, timestamptz,
  text, text, text, jsonb, integer, text, integer, integer) to anon, authenticated;

-- Disponibilità di un singolo annuncio per il calendario della scheda (giorni pieni occupati)
create or replace function public.listing_busy_days(p_listing uuid, p_from date, p_to date)
returns table (day date) language sql stable security definer set search_path = public as $$
  with units as (
    select vu.id from listing_units lu join vehicle_units vu on vu.id = lu.vehicle_unit_id
     join listings l on l.id = lu.listing_id
     where lu.listing_id = p_listing and l.status = 'published' and vu.operational_status = 'active'
  ), days as (
    select d::date as day from generate_series(p_from, least(p_to, p_from + 366), interval '1 day') d
  )
  select days.day from days
  where (select count(*) from units) > 0
    and not exists (
      select 1 from units u
       where not exists (
         select 1 from unit_reservations r
          where r.vehicle_unit_id = u.id and r.active and (r.kind <> 'hold' or r.expires_at > now())
            and r.period && tstzrange((days.day::timestamp at time zone 'Europe/Rome'),
                                      ((days.day + 1)::timestamp at time zone 'Europe/Rome'), '[)')))
$$;
grant execute on function public.listing_busy_days(uuid, date, date) to anon, authenticated;

-- Preventivo pubblico (stesso calcolo usato in prenotazione)
create or replace function public.quote(p_listing uuid, p_pickup timestamptz, p_return timestamptz, p_extras jsonb default '[]')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from listings where id = p_listing and status = 'published') then
    raise exception 'LISTING_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  return private.quote_listing(p_listing, p_pickup, p_return, p_extras);
end $$;
grant execute on function public.quote(uuid, timestamptz, timestamptz, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dati sbloccati per fase (decisione D1)
-- ---------------------------------------------------------------------------
-- Identità legale del noleggiatore: dal momento in cui il provider accetta (prima del pagamento)
create or replace function public.get_booking_provider_identity(p_booking uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('legal_name', o.legal_name, 'trade_name', o.trade_name,
                            'vat_number', o.vat_number, 'legal_address', o.legal_address)
  from bookings b join organizations o on o.id = b.organization_id
  where b.id = p_booking
    and (b.customer_id = auth.uid() or private.is_staff())
    and b.status in ('accepted', 'confirmed', 'picked_up', 'completed', 'cancelled', 'no_show')
$$;

-- Dati operativi di ritiro: solo a prenotazione confermata/pagata
create or replace function public.get_booking_pickup_details(p_booking uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('trade_name', coalesce(o.trade_name, o.legal_name),
                            'address', loc.address_line, 'postal_code', loc.postal_code, 'city', loc.city,
                            'province', loc.province, 'latitude', loc.latitude, 'longitude', loc.longitude,
                            'phone', coalesce(loc.phone, o.business_phone), 'email', o.business_email,
                            'instructions', loc.pickup_instructions, 'opening_hours', loc.opening_hours)
  from bookings b
  join locations loc on loc.id = b.location_id
  join organizations o on o.id = b.organization_id
  where b.id = p_booking
    and (b.customer_id = auth.uid() or private.is_staff())
    and b.status in ('confirmed', 'picked_up', 'completed')
$$;
grant execute on function public.get_booking_provider_identity(uuid), public.get_booking_pickup_details(uuid)
  to authenticated;
revoke execute on function public.get_booking_provider_identity(uuid), public.get_booking_pickup_details(uuid)
  from anon, public;
