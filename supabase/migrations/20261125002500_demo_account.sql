-- 0025 · Account dimostrativo per i concessionari (concessionario@keyrent.it). Rieseguibile.
-- · organizations.is_demo: attività di prova. Nessuna prenotazione vera sui suoi annunci (DEMO_LISTING).
-- · listings.demo_keep: i 10 annunci di esempio. Dal browser non si toccano (DEMO_PROTECTED); ogni notte tornano com'erano.
-- · Gli annunci creati provando la demo: approvati da soli dopo 30 secondi, online 24 ore, poi cancellati.
-- · Noleggi finti (passati, in corso, futuri, richieste) rigenerati ogni notte rispetto alla data di oggi.

alter table public.organizations add column if not exists is_demo boolean not null default false;
alter table public.listings add column if not exists demo_keep boolean not null default false;

-- ---------- Nessuna prenotazione vera su un annuncio dimostrativo ----------
create or replace function private.guard_demo_booking() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('keyrent.demo_seed', true), '') <> 'on'
     and exists (select 1 from organizations where id = new.organization_id and is_demo) then
    raise exception 'DEMO_LISTING' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bookings_demo_guard on public.bookings;
create trigger bookings_demo_guard before insert on public.bookings
  for each row execute function private.guard_demo_booking();

-- ---------- I 10 annunci di esempio non si modificano dal browser ----------
-- (le funzioni del server girano come service_role/postgres: il ripristino notturno e lo staff non sono bloccati)
create or replace function private.guard_demo_keep() returns trigger
language plpgsql set search_path = public as $$
declare v_listing uuid;
begin
  if current_user <> 'authenticated' then return coalesce(new, old); end if;
  v_listing := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
               ->> case when tg_table_name = 'listings' then 'id' else 'listing_id' end;
  if exists (select 1 from listings where id = v_listing and demo_keep) then
    raise exception 'DEMO_PROTECTED' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists listings_demo_keep on public.listings;
create trigger listings_demo_keep before update or delete on public.listings
  for each row execute function private.guard_demo_keep();
drop trigger if exists media_demo_keep on public.listing_media;
create trigger media_demo_keep before insert or update or delete on public.listing_media
  for each row execute function private.guard_demo_keep();
drop trigger if exists prices_demo_keep on public.pricing_rules;
create trigger prices_demo_keep before insert or update or delete on public.pricing_rules
  for each row execute function private.guard_demo_keep();
drop trigger if exists terms_demo_keep on public.rental_terms;
create trigger terms_demo_keep before insert or update or delete on public.rental_terms
  for each row execute function private.guard_demo_keep();

-- ---------- Storico immutabile, tranne i noleggi finti della demo (solo durante il ripristino) ----------
create or replace function private.forbid_mutation_except_demo() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('keyrent.demo_seed', true), '') = 'on'
     and exists (select 1 from bookings b where b.id = old.booking_id and b.stripe_payment_intent_id like 'pi\_demo\_%') then
    return old;
  end if;
  raise exception 'IMMUTABLE: % non può essere modificata o cancellata', tg_table_name using errcode = 'P0001';
end $$;
drop trigger if exists booking_events_immutable on public.booking_events;
create trigger booking_events_immutable before update or delete on public.booking_events
  for each row execute function private.forbid_mutation_except_demo();
drop trigger if exists ledger_immutable on public.ledger_entries;
create trigger ledger_immutable before update or delete on public.ledger_entries
  for each row execute function private.forbid_mutation_except_demo();

-- ---------- Approvazione automatica dopo 30 secondi ----------
create or replace function private.demo_autoapprove() returns integer
language plpgsql security definer set search_path = public as $$
declare v_actor uuid; r record; n integer := 0;
begin
  select user_id into v_actor from staff_members where active and role = 'admin' order by created_at limit 1;
  if v_actor is null then return 0; end if;
  for r in
    select l.id from listings l
      join organizations o on o.id = l.organization_id and o.is_demo
     where l.status = 'pending_review' and not l.demo_keep
       and exists (select 1 from listing_revisions v where v.listing_id = l.id and v.status = 'pending_review'
                     and v.submitted_at <= now() - interval '30 seconds')
  loop
    perform private.listing_transition(r.id, 'approved', v_actor, null,
      jsonb_build_object('note', 'Approvato automaticamente: account di prova, resta online 24 ore'));
    n := n + 1;
  end loop;
  -- modifiche proposte agli annunci di prova già online (non a quelli di esempio)
  for r in
    select v.id from listing_revisions v
      join listings l on l.id = v.listing_id and not l.demo_keep and l.status <> 'pending_review'
      join organizations o on o.id = l.organization_id and o.is_demo
     where v.status = 'pending_review' and v.submitted_at <= now() - interval '30 seconds'
  loop
    perform private.review_listing_changes(r.id, v_actor, true, jsonb_build_object('note', 'Approvata automaticamente (account di prova)'));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Noleggi finti, sempre "freschi" rispetto a oggi ----------
-- Clienti finti = utenti con email @demo.keyrent.it (creati dallo script di preparazione).
create or replace function private.demo_seed_bookings(p_org uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_customers uuid[]; v_policy uuid; c record; l record; t record;
  v_unit uuid; v_quote jsonb; v_total integer; v_comm integer; v_id uuid;
  v_day timestamptz := date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  i integer := 0; k integer; n integer := 0; s record;
  v_names text[] := array['Giulia Bianchi', 'Luca Ferrari', 'Martina Rossi', 'Alessandro Conti', 'Sara Colombo', 'Davide Ricci', 'Elena Marino', 'Matteo Greco'];
begin
  if not exists (select 1 from organizations where id = p_org and is_demo) then
    raise exception 'NOT_DEMO' using errcode = 'P0001';
  end if;
  select array_agg(u.id order by u.email) into v_customers from auth.users u where u.email like '%@demo.keyrent.it';
  if v_customers is null then return 0; end if;
  select v.id into v_policy from cancellation_policy_versions v join cancellation_policies p on p.id = v.policy_id
   where p.code = 'standard' order by v.version desc limit 1;

  perform set_config('keyrent.demo_seed', 'on', true);

  -- via i noleggi finti precedenti (solo quelli creati qui: riconoscibili dal pagamento pi_demo_)
  create temporary table if not exists _demo_old (id uuid) on commit drop;
  delete from _demo_old;
  insert into _demo_old select id from bookings where organization_id = p_org and stripe_payment_intent_id like 'pi\_demo\_%';
  delete from booking_events where booking_id in (select id from _demo_old);
  delete from ledger_entries where booking_id in (select id from _demo_old);
  delete from reviews where booking_id in (select id from _demo_old);
  delete from refunds where booking_id in (select id from _demo_old);
  delete from payments where booking_id in (select id from _demo_old);
  delete from payouts where booking_id in (select id from _demo_old);
  delete from unit_reservations where booking_id in (select id from _demo_old);
  update conversations set booking_id = null where booking_id in (select id from _demo_old);
  delete from bookings where id in (select id from _demo_old);

  for l in
    select li.* from listings li where li.organization_id = p_org and li.demo_keep and li.status = 'published' order by li.created_at, li.id
  loop
    i := i + 1;
    select * into t from rental_terms where listing_id = l.id;
    select * into c from private.commission_for(l.organization_id, l.category_id, now());
    select lu.vehicle_unit_id into v_unit from listing_units lu where lu.listing_id = l.id order by lu.vehicle_unit_id limit 1;
    -- calendario per mezzo: 3 noleggi conclusi negli ultimi mesi + uno "di oggi" che dipende dal mezzo
    for s in
      select * from (values
        (1, -88 - i, 3, 'completed'), (2, -54 - (i % 5), 2 + (i % 3), 'completed'), (3, -21 - (i % 4), 2, 'completed'),
        (4, case i % 4 when 0 then -1 when 1 then 4 + i when 2 then -2 else 2 + i end,
            case i % 4 when 0 then 3 when 1 then 2 when 2 then 4 else 3 end,
            case i % 4 when 0 then 'picked_up' when 1 then 'requested' when 2 then 'picked_up' else 'confirmed' end)
      ) as x(nr, start_day, days, status)
    loop
      k := (i * 3 + s.nr) % array_length(v_customers, 1) + 1;
      begin
        v_quote := private.quote_listing(l.id, v_day + make_interval(days => s.start_day, hours => 10),
                                         v_day + make_interval(days => s.start_day + s.days, hours => 10), '[]'::jsonb);
      exception when others then continue;  -- mezzo senza tariffa per quella durata: salta
      end;
      v_total := (v_quote ->> 'total_cents')::integer;
      v_comm := least(v_total, greatest(round(v_total * c.rate_bps / 10000.0)::integer, c.min_fee_cents));
      insert into bookings (customer_id, organization_id, listing_id, vehicle_unit_id, location_id, status, pickup_at, return_at,
                            quote, total_cents, commission_bps, commission_cents, provider_net_cents, deposit_cents,
                            cancellation_policy_version_id, terms_snapshot, driver, payment_required, payment_ready,
                            stripe_payment_intent_id, provider_response_due_at, accepted_at, confirmed_at, picked_up_at, completed_at, created_at)
      values (v_customers[k], p_org, l.id, v_unit, l.location_id, s.status::booking_status,
              v_day + make_interval(days => s.start_day, hours => 10), v_day + make_interval(days => s.start_day + s.days, hours => 10),
              v_quote, v_total, c.rate_bps, v_comm, v_total - v_comm, t.deposit_cents, v_policy, to_jsonb(t),
              jsonb_build_object('first_name', split_part(v_names[(k - 1) % 8 + 1], ' ', 1), 'last_name', split_part(v_names[(k - 1) % 8 + 1], ' ', 2),
                                 'birth_year', 1978 + (k * 3) % 20, 'license_year', 1998 + (k * 3) % 20),
              true, true, 'pi_demo_new',
              case when s.status = 'requested' then now() + interval '20 hours' end,
              case when s.status <> 'requested' then v_day + make_interval(days => least(s.start_day - 2, -1)) end,
              case when s.status <> 'requested' then v_day + make_interval(days => least(s.start_day - 2, -1)) end,
              case when s.status in ('picked_up', 'completed') then v_day + make_interval(days => s.start_day, hours => 10) end,
              case when s.status = 'completed' then v_day + make_interval(days => s.start_day + s.days, hours => 10) end,
              v_day + make_interval(days => least(s.start_day - 3, -1)))
      returning id into v_id;
      update bookings set stripe_payment_intent_id = 'pi_demo_' || v_id where id = v_id;

      insert into unit_reservations (vehicle_unit_id, period, kind, booking_id, expires_at, active)
      values (v_unit, tstzrange(v_day + make_interval(days => s.start_day, hours => 10),
                                v_day + make_interval(days => s.start_day + s.days, hours => 10, mins => t.buffer_minutes), '[)'),
              case when s.status = 'requested' then 'hold' else 'booking' end, v_id,
              case when s.status = 'requested' then now() + interval '20 hours' end, true);

      insert into payments (booking_id, stripe_payment_intent_id, amount_cents, status, authorized_at, captured_at, captured_cents)
      values (v_id, 'pi_demo_' || v_id, v_total,
              case when s.status = 'requested' then 'authorized' else 'captured' end::payment_status,
              now() - interval '1 day', case when s.status <> 'requested' then now() - interval '1 day' end,
              case when s.status = 'requested' then 0 else v_total end);

      if s.status <> 'requested' then
        insert into payouts (booking_id, organization_id, amount_cents, status, scheduled_for)
        values (v_id, p_org, v_total - v_comm,
                case s.status when 'completed' then 'paid' when 'picked_up' then 'scheduled' else 'pending_pickup' end::payout_status,
                v_day + make_interval(days => s.start_day + 1, hours => 10));
      end if;
      if s.status = 'completed' and s.nr <> 2 then
        insert into reviews (booking_id, listing_id, author_id, author_side, rating, body)
        values (v_id, l.id, v_customers[k], 'customer', case when (i + s.nr) % 4 = 0 then 4 else 5 end,
                (array['Mezzo perfetto e pulitissimo, ritiro velocissimo. Consigliato!',
                       'Tutto come descritto, noleggiatore gentile e puntuale.',
                       'Ottima esperienza, prenoterò di nuovo.',
                       'Prezzo onesto e mezzo in condizioni impeccabili.'])[(i + s.nr) % 4 + 1]);
      end if;
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- ---------- Ripristino notturno ----------
create or replace function private.demo_reset() returns jsonb
language plpgsql security definer set search_path = public as $$
declare o record; v_deleted integer := 0; v_bookings integer := 0; v_actor uuid; r record;
begin
  select user_id into v_actor from staff_members where active and role = 'admin' order by created_at limit 1;
  for o in select id from organizations where is_demo loop
    -- annunci creati provando la demo: online 24 ore, poi via
    delete from conversations where listing_id in
      (select id from listings where organization_id = o.id and not demo_keep and created_at < now() - interval '24 hours');
    with d as (delete from listings where organization_id = o.id and not demo_keep and created_at < now() - interval '24 hours' returning id)
    select count(*) into v_deleted from d;
    delete from vehicle_units vu where vu.organization_id = o.id
      and not exists (select 1 from listing_units lu where lu.vehicle_unit_id = vu.id);
    -- giorni bloccati provando il calendario: via
    delete from unit_reservations ur using vehicle_units vu
     where ur.vehicle_unit_id = vu.id and vu.organization_id = o.id and ur.kind in ('block', 'maintenance');
    -- annunci di esempio: modifiche proposte scartate, di nuovo online
    delete from listing_revisions v using listings l
     where v.listing_id = l.id and l.organization_id = o.id and l.demo_keep and v.status = 'pending_review';
    for r in select id from listings where organization_id = o.id and demo_keep and status <> 'published' loop
      update listings set status = 'published', published_at = coalesce(published_at, now()) where id = r.id;
    end loop;
    v_bookings := v_bookings + private.demo_seed_bookings(o.id);
  end loop;
  return jsonb_build_object('annunci_cancellati', v_deleted, 'noleggi_creati', v_bookings);
end $$;

-- ---------- Ponti per il server (solo service role) ----------
create or replace function public.svc_demo_autoapprove() returns integer
language sql security invoker set search_path = public as $$ select private.demo_autoapprove(); $$;
create or replace function public.svc_demo_reset() returns jsonb
language sql security invoker set search_path = public as $$ select private.demo_reset(); $$;
create or replace function public.svc_is_demo_user(p_user uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from organization_members m join organizations o on o.id = m.organization_id
                  where m.user_id = p_user and m.status = 'active' and o.is_demo);
$$;
revoke execute on function public.svc_demo_autoapprove(), public.svc_demo_reset(), public.svc_is_demo_user(uuid)
  from public, anon, authenticated;
grant execute on function public.svc_demo_autoapprove(), public.svc_demo_reset(), public.svc_is_demo_user(uuid) to service_role;
revoke execute on function private.demo_autoapprove(), private.demo_reset(), private.demo_seed_bookings(uuid),
  private.guard_demo_booking(), private.guard_demo_keep() from public;

-- la scheda pubblica sa se un annuncio è dimostrativo (per l'avviso "prenotazioni aperte dal lancio")
create or replace function public.listing_is_demo(p_listing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select o.is_demo from listings l join organizations o on o.id = l.organization_id
                    where l.id = p_listing and l.status = 'published'), false);
$$;
revoke execute on function public.listing_is_demo(uuid) from public;
grant execute on function public.listing_is_demo(uuid) to anon, authenticated;
grant execute on function private.demo_autoapprove(), private.demo_reset() to service_role;
