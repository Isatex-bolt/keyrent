-- KeyRent · 0003 · Disponibilità, prenotazioni, pagamenti, payout, ledger
-- Tutti i cambi di stato passano da funzioni in `private`, eseguibili solo dal server (service_role).

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.booking_status as enum
  ('requested', 'accepted', 'confirmed', 'picked_up', 'completed', 'declined', 'expired', 'cancelled', 'no_show');
create type public.payment_status as enum
  ('requires_payment_method', 'authorized', 'captured', 'partially_refunded', 'refunded', 'canceled', 'failed', 'disputed');
create type public.payout_status as enum
  ('not_scheduled', 'pending_pickup', 'scheduled', 'processing', 'paid', 'failed', 'reversed', 'on_hold');

-- Codice prenotazione leggibile (senza 0/O/1/I/L)
create or replace function private.gen_booking_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea := gen_random_bytes(6);
  out text := 'KR-';
  i integer;
begin
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

-- ---------------------------------------------------------------------------
-- Prenotazioni
-- ---------------------------------------------------------------------------
create table public.bookings (
  id                             uuid primary key default gen_random_uuid(),
  code                           text not null unique default private.gen_booking_code(),
  customer_id                    uuid not null references public.profiles(id),
  organization_id                uuid not null references public.organizations(id),
  listing_id                     uuid not null references public.listings(id),
  vehicle_unit_id                uuid references public.vehicle_units(id),
  location_id                    uuid not null references public.locations(id),
  source                         public.inventory_kind not null default 'direct',
  status                         public.booking_status not null default 'requested',
  pickup_at                      timestamptz not null,
  return_at                      timestamptz not null,
  currency                       char(3) not null default 'EUR',
  quote                          jsonb not null,          -- righe di prezzo calcolate dal server
  total_cents                    integer not null check (total_cents > 0),
  commission_bps                 integer not null,
  commission_cents               integer not null check (commission_cents >= 0),
  provider_net_cents             integer not null check (provider_net_cents >= 0),
  deposit_cents                  integer not null default 0,
  cancellation_policy_version_id uuid not null references public.cancellation_policy_versions(id),
  terms_snapshot                 jsonb not null,          -- condizioni accettate dal cliente
  driver                         jsonb not null default '{}'::jsonb,
  provider_response_due_at       timestamptz,
  customer_confirm_due_at        timestamptz,
  accepted_at                    timestamptz,
  confirmed_at                   timestamptz,
  picked_up_at                   timestamptz,
  completed_at                   timestamptz,
  cancelled_at                   timestamptz,
  cancelled_by                   text check (cancelled_by in ('customer', 'provider', 'staff', 'system')),
  cancel_reason                  text,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  check (return_at > pickup_at),
  check (total_cents = commission_cents + provider_net_cents)
);
create index bookings_customer_idx on public.bookings(customer_id, pickup_at desc);
create index bookings_org_idx on public.bookings(organization_id, pickup_at desc);
create index bookings_status_due_idx on public.bookings(status, provider_response_due_at, customer_confirm_due_at);
create trigger bookings_touch before update on public.bookings
  for each row execute function private.touch_updated_at();

create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status   public.booking_status not null,
  actor_id    uuid,
  actor_type  text not null check (actor_type in ('customer', 'provider', 'staff', 'system', 'webhook')),
  reason      text,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events(booking_id, created_at);
create trigger booking_events_immutable before update or delete on public.booking_events
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Disponibilità: il vincolo di esclusione rende impossibile il double booking
-- ---------------------------------------------------------------------------
create table public.unit_reservations (
  id              uuid primary key default gen_random_uuid(),
  vehicle_unit_id uuid not null references public.vehicle_units(id) on delete cascade,
  period          tstzrange not null check (not isempty(period)),   -- ritiro → riconsegna + buffer
  kind            text not null check (kind in ('hold', 'booking', 'block', 'maintenance', 'external')),
  booking_id      uuid references public.bookings(id),
  expires_at      timestamptz,
  active          boolean not null default true,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  check (kind <> 'hold' or expires_at is not null),
  constraint unit_reservations_no_overlap exclude using gist (
    vehicle_unit_id with =,
    period with &&
  ) where (active)
);
create index unit_reservations_booking_idx on public.unit_reservations(booking_id);

-- ---------------------------------------------------------------------------
-- Pagamenti, rimborsi, payout, ledger, eventi Stripe
-- ---------------------------------------------------------------------------
create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null unique references public.bookings(id),
  stripe_payment_intent_id text not null unique,
  amount_cents             integer not null check (amount_cents > 0),
  currency                 char(3) not null default 'EUR',
  status                   public.payment_status not null,
  authorized_at            timestamptz,
  captured_at              timestamptz,
  captured_cents           integer not null default 0,
  refunded_cents           integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (refunded_cents <= captured_cents)
);
create trigger payments_touch before update on public.payments
  for each row execute function private.touch_updated_at();

create table public.refunds (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references public.payments(id),
  booking_id       uuid not null references public.bookings(id),
  amount_cents     integer not null check (amount_cents > 0),
  reason           text not null,
  policy_rule      jsonb,
  stripe_refund_id text unique,
  status           text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at       timestamptz not null default now()
);

create table public.payouts (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null unique references public.bookings(id),
  organization_id    uuid not null references public.organizations(id),
  amount_cents       integer not null check (amount_cents >= 0),
  status             public.payout_status not null default 'not_scheduled',
  scheduled_for      timestamptz,
  stripe_transfer_id text unique,
  failure_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index payouts_due_idx on public.payouts(status, scheduled_for);
create trigger payouts_touch before update on public.payouts
  for each row execute function private.touch_updated_at();

-- Partita doppia: ogni gruppo di righe somma a zero (controllo a fine transazione)
create table public.ledger_entries (
  id              bigint generated always as identity primary key,
  entry_group     uuid not null,
  booking_id      uuid references public.bookings(id),
  organization_id uuid references public.organizations(id),
  account         text not null check (account in ('stripe_balance', 'platform_revenue', 'provider_payable')),
  amount_cents    integer not null,
  description     text not null,
  created_at      timestamptz not null default now()
);
create index ledger_booking_idx on public.ledger_entries(booking_id);
create index ledger_org_idx on public.ledger_entries(organization_id, account);
create trigger ledger_immutable before update or delete on public.ledger_entries
  for each row execute function private.forbid_mutation();

create or replace function private.check_ledger_group() returns trigger
language plpgsql as $$
declare s bigint;
begin
  select coalesce(sum(amount_cents), 0) into s from public.ledger_entries where entry_group = new.entry_group;
  if s <> 0 then
    raise exception 'LEDGER_UNBALANCED: gruppo % somma a %', new.entry_group, s using errcode = 'P0001';
  end if;
  return null;
end $$;
create constraint trigger ledger_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function private.check_ledger_group();

create table public.stripe_events (
  event_id     text primary key,
  type         text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);

-- ---------------------------------------------------------------------------
-- Funzioni di dominio
-- ---------------------------------------------------------------------------

-- Preventivo calcolato SOLO dal server. Sceglie la combinazione più economica tra le unità di prezzo
-- definite dal provider (ora, mezza giornata = fino a 4 h, giorno = 24 h, settimana = 7 giorni).
create or replace function private.quote_listing(
  p_listing uuid, p_pickup timestamptz, p_return timestamptz, p_extras jsonb default '[]'::jsonb
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_minutes numeric := extract(epoch from (p_return - p_pickup)) / 60;
  v_days    integer;
  v_date    date := (p_pickup at time zone 'Europe/Rome')::date;
  p_hour integer; p_half integer; p_day integer; p_week integer;
  best integer; best_unit text; best_qty integer; cand integer;
  v_extras_cents integer := 0;
  v_extra_lines jsonb := '[]'::jsonb;
  e record; q integer;
begin
  if v_minutes <= 0 then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
  v_days := greatest(1, ceil(v_minutes / 1440)::integer);

  select
    (select price_cents from pricing_rules r where r.listing_id = p_listing and r.unit = 'hour'
       and (r.valid_from is null or r.valid_from <= v_date) and (r.valid_to is null or r.valid_to >= v_date)
       order by r.priority desc, (r.valid_from is not null) desc limit 1),
    (select price_cents from pricing_rules r where r.listing_id = p_listing and r.unit = 'half_day'
       and (r.valid_from is null or r.valid_from <= v_date) and (r.valid_to is null or r.valid_to >= v_date)
       order by r.priority desc, (r.valid_from is not null) desc limit 1),
    (select price_cents from pricing_rules r where r.listing_id = p_listing and r.unit = 'day'
       and (r.valid_from is null or r.valid_from <= v_date) and (r.valid_to is null or r.valid_to >= v_date)
       order by r.priority desc, (r.valid_from is not null) desc limit 1),
    (select price_cents from pricing_rules r where r.listing_id = p_listing and r.unit = 'week'
       and (r.valid_from is null or r.valid_from <= v_date) and (r.valid_to is null or r.valid_to >= v_date)
       order by r.priority desc, (r.valid_from is not null) desc limit 1)
  into p_hour, p_half, p_day, p_week;

  if p_hour is not null then
    best := ceil(v_minutes / 60)::integer * p_hour; best_unit := 'hour'; best_qty := ceil(v_minutes / 60)::integer;
  end if;
  if p_half is not null and v_minutes <= 480 then
    cand := ceil(v_minutes / 240)::integer * p_half;
    if best is null or cand < best then best := cand; best_unit := 'half_day'; best_qty := ceil(v_minutes / 240)::integer; end if;
  end if;
  if p_day is not null then
    cand := v_days * p_day;
    if best is null or cand < best then best := cand; best_unit := 'day'; best_qty := v_days; end if;
  end if;
  if p_week is not null then
    if p_day is not null then
      cand := (v_days / 7) * p_week + least((v_days % 7) * p_day, p_week);
    else
      cand := ceil(v_days / 7.0)::integer * p_week;
    end if;
    if best is null or cand < best then best := cand; best_unit := 'week'; best_qty := v_days; end if;
  end if;

  if best is null then
    raise exception 'NO_PRICE: nessuna tariffa applicabile' using errcode = 'P0001';
  end if;

  for e in
    select x.id, x.name, x.price_cents, x.charge, x.max_qty, (j ->> 'qty')::integer as qty
    from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) j
    join extras x on x.id = (j ->> 'id')::uuid and x.listing_id = p_listing
  loop
    q := least(greatest(coalesce(e.qty, 1), 1), e.max_qty);
    cand := case when e.charge = 'per_day' then e.price_cents * q * v_days else e.price_cents * q end;
    v_extras_cents := v_extras_cents + cand;
    v_extra_lines := v_extra_lines || jsonb_build_object('id', e.id, 'name', e.name, 'qty', q, 'cents', cand);
  end loop;

  return jsonb_build_object(
    'base_cents', best, 'unit', best_unit, 'qty', best_qty, 'days', v_days,
    'extras', v_extra_lines, 'extras_cents', v_extras_cents, 'total_cents', best + v_extras_cents
  );
end $$;

-- Transizioni ammesse
create or replace function private.assert_booking_transition(p_from public.booking_status, p_to public.booking_status)
returns void language plpgsql immutable as $$
begin
  if not (
       (p_from = 'requested' and p_to in ('accepted', 'declined', 'expired', 'cancelled'))
    or (p_from = 'accepted'  and p_to in ('confirmed', 'expired', 'cancelled'))
    or (p_from = 'confirmed' and p_to in ('picked_up', 'cancelled', 'no_show'))
    or (p_from = 'picked_up' and p_to = 'completed')
  ) then
    raise exception 'INVALID_TRANSITION: % → %', p_from, p_to using errcode = 'P0001';
  end if;
end $$;

create or replace function private.log_booking_event(
  p_booking uuid, p_from public.booking_status, p_to public.booking_status,
  p_actor uuid, p_actor_type text, p_reason text default null, p_data jsonb default null
) returns void language sql security definer set search_path = public as $$
  insert into booking_events (booking_id, from_status, to_status, actor_id, actor_type, reason, data)
  values (p_booking, p_from, p_to, p_actor, p_actor_type, p_reason, p_data);
$$;

-- 1) RICHIESTA: crea booking + hold atomico. Per i listing in pool prova le unità finché una è libera.
create or replace function private.create_booking_request(
  p_customer uuid, p_listing uuid, p_pickup timestamptz, p_return timestamptz,
  p_extras jsonb default '[]'::jsonb, p_driver jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l record; t record; c record;
  v_policy_version uuid;
  v_quote jsonb; v_total integer; v_commission integer;
  v_booking uuid; v_unit uuid; v_due timestamptz; v_until timestamptz;
  u record;
begin
  if p_pickup <= now() then
    raise exception 'PICKUP_IN_PAST' using errcode = 'P0001';
  end if;

  select * into l from listings where id = p_listing for share;
  if not found or l.status <> 'published' then
    raise exception 'LISTING_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from organization_members m where m.organization_id = l.organization_id and m.user_id = p_customer) then
    raise exception 'SELF_BOOKING: non puoi prenotare un mezzo della tua organizzazione' using errcode = 'P0001';
  end if;

  select * into t from rental_terms where listing_id = p_listing;
  if not found then
    raise exception 'TERMS_MISSING' using errcode = 'P0001';
  end if;
  if extract(epoch from (p_return - p_pickup)) / 60 < t.min_duration_minutes
     or (t.max_duration_minutes is not null and extract(epoch from (p_return - p_pickup)) / 60 > t.max_duration_minutes) then
    raise exception 'DURATION_OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  select v.id into v_policy_version
  from cancellation_policy_versions v
  join cancellation_policies p on p.id = v.policy_id
  where p.id = coalesce(t.cancellation_policy_id, (select id from cancellation_policies where code = 'standard'))
    and v.effective_from <= now()
  order by v.version desc limit 1;
  if v_policy_version is null then
    raise exception 'POLICY_MISSING' using errcode = 'P0001';
  end if;

  v_quote := private.quote_listing(p_listing, p_pickup, p_return, p_extras);
  v_total := (v_quote ->> 'total_cents')::integer;

  select * into c from private.commission_for(l.organization_id, l.category_id, now());
  if not found then
    raise exception 'COMMISSION_RULE_MISSING' using errcode = 'P0001';
  end if;
  v_commission := least(v_total, greatest(round(v_total * c.rate_bps / 10000.0)::integer, c.min_fee_cents));

  select least(now() + make_interval(mins => o.response_window_minutes), p_pickup - interval '1 hour')
    into v_due from organizations o where o.id = l.organization_id;
  if v_due <= now() then
    raise exception 'TOO_LATE_TO_REQUEST' using errcode = 'P0001';
  end if;

  insert into bookings (customer_id, organization_id, listing_id, location_id, source, pickup_at, return_at,
                        quote, total_cents, commission_bps, commission_cents, provider_net_cents, deposit_cents,
                        cancellation_policy_version_id, terms_snapshot, driver, provider_response_due_at)
  values (p_customer, l.organization_id, l.id, l.location_id, l.inventory_kind, p_pickup, p_return,
          v_quote, v_total, c.rate_bps, v_commission, v_total - v_commission, t.deposit_cents,
          v_policy_version, to_jsonb(t), coalesce(p_driver, '{}'::jsonb), v_due)
  returning id into v_booking;

  v_until := p_return + make_interval(mins => t.buffer_minutes);

  for u in
    select vu.id
    from listing_units lu
    join vehicle_units vu on vu.id = lu.vehicle_unit_id
    where lu.listing_id = p_listing and vu.operational_status = 'active'
    order by (select count(*) from unit_reservations r
              where r.vehicle_unit_id = vu.id and r.active and upper(r.period) > now()), vu.id
  loop
    -- libera gli hold scaduti di questa unità, così un hold scaduto non blocca mai nessuno
    update unit_reservations set active = false
     where vehicle_unit_id = u.id and active and kind = 'hold' and expires_at < now();
    begin
      insert into unit_reservations (vehicle_unit_id, period, kind, booking_id, expires_at, created_by)
      values (u.id, tstzrange(p_pickup, v_until, '[)'), 'hold', v_booking, v_due, p_customer);
      v_unit := u.id;
      exit;
    exception when exclusion_violation then
      -- unità occupata (anche da una transazione concorrente appena committata): prova la successiva
      null;
    end;
  end loop;

  if v_unit is null then
    raise exception 'NOT_AVAILABLE: date non più disponibili' using errcode = 'P0001';
  end if;

  update bookings set vehicle_unit_id = v_unit where id = v_booking;
  perform private.log_booking_event(v_booking, null, 'requested', p_customer, 'customer');
  return v_booking;
end $$;

-- Registrazione della preautorizzazione Stripe (dopo la conferma della carta)
create or replace function private.record_authorization(p_booking uuid, p_payment_intent text, p_amount integer)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  -- il webhook può arrivare anche dopo che il provider ha già accettato
  if b.status not in ('requested', 'accepted') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if p_amount <> b.total_cents then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;
  insert into payments (booking_id, stripe_payment_intent_id, amount_cents, status, authorized_at)
  values (p_booking, p_payment_intent, p_amount, 'authorized', now())
  on conflict (stripe_payment_intent_id) do nothing;   -- idempotente
end $$;

-- Verifica che l'utente sia membro dell'organizzazione con uno dei ruoli
create or replace function private.assert_member(p_org uuid, p_user uuid, p_roles public.org_role[])
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from organization_members m
                 where m.organization_id = p_org and m.user_id = p_user
                   and m.status = 'active' and m.role = any (p_roles)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end $$;

-- 2) RISPOSTA PROVIDER
create or replace function private.accept_booking(p_booking uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record; v_due timestamptz;
begin
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  perform private.assert_booking_transition(b.status, 'accepted');
  if b.provider_response_due_at < now() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from unit_reservations r where r.booking_id = p_booking and r.active) then
    raise exception 'HOLD_LOST' using errcode = 'P0001';
  end if;

  v_due := least(now() + interval '24 hours', b.pickup_at - interval '30 minutes');
  update bookings set status = 'accepted', accepted_at = now(), customer_confirm_due_at = v_due where id = p_booking;
  update unit_reservations set expires_at = v_due where booking_id = p_booking and active and kind = 'hold';
  perform private.log_booking_event(p_booking, b.status, 'accepted', p_actor, 'provider');
end $$;

create or replace function private.decline_booking(p_booking uuid, p_actor uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  perform private.assert_booking_transition(b.status, 'declined');
  update bookings set status = 'declined', cancel_reason = p_reason where id = p_booking;
  update unit_reservations set active = false where booking_id = p_booking;
  perform private.log_booking_event(p_booking, b.status, 'declined', p_actor, 'provider', p_reason);
  -- il server annulla la preautorizzazione Stripe (payments.status → canceled via webhook)
end $$;

-- 3) CONFERMA CLIENTE dopo capture riuscita. Idempotente: se già confermata non fa nulla.
create or replace function private.confirm_booking(p_booking uuid, p_customer uuid, p_payment_intent text, p_captured integer)
returns void language plpgsql security definer set search_path = public as $$
declare b record; p record; g uuid := gen_random_uuid();
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.customer_id <> p_customer then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if b.status in ('confirmed', 'picked_up', 'completed') then return; end if;
  perform private.assert_booking_transition(b.status, 'confirmed');
  if b.customer_confirm_due_at < now() then raise exception 'CONFIRM_WINDOW_EXPIRED' using errcode = 'P0001'; end if;

  select * into p from payments where booking_id = p_booking for update;
  if not found or p.stripe_payment_intent_id <> p_payment_intent then
    raise exception 'PAYMENT_MISMATCH' using errcode = 'P0001';
  end if;
  if p_captured <> b.total_cents then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;

  update payments set status = 'captured', captured_at = now(), captured_cents = p_captured where id = p.id;
  update unit_reservations set kind = 'booking', expires_at = null where booking_id = p_booking and active;
  if not found then raise exception 'HOLD_LOST' using errcode = 'P0001'; end if;
  update bookings set status = 'confirmed', confirmed_at = now() where id = p_booking;

  insert into ledger_entries (entry_group, booking_id, organization_id, account, amount_cents, description) values
    (g, p_booking, null, 'stripe_balance', b.total_cents, 'Incasso prenotazione ' || b.code),
    (g, p_booking, null, 'platform_revenue', -b.commission_cents, 'Commissione KeyRent'),
    (g, p_booking, b.organization_id, 'provider_payable', -b.provider_net_cents, 'Netto provider in attesa del ritiro');

  insert into payouts (booking_id, organization_id, amount_cents, status, scheduled_for)
  values (p_booking, b.organization_id, b.provider_net_cents, 'pending_pickup', b.pickup_at + interval '24 hours');

  perform private.log_booking_event(p_booking, b.status, 'confirmed', p_customer, 'customer');
end $$;

-- 4) RITIRO (automatico all'orario di ritiro dal worker, o check-in del provider)
create or replace function private.mark_picked_up(p_booking uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  if p_actor is not null then
    perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  end if;
  perform private.assert_booking_transition(b.status, 'picked_up');
  if now() < b.pickup_at - interval '3 hours' then raise exception 'TOO_EARLY' using errcode = 'P0001'; end if;
  update bookings set status = 'picked_up', picked_up_at = now() where id = p_booking;
  update payouts set status = 'scheduled',
                     scheduled_for = greatest(scheduled_for, now() + interval '24 hours')
   where booking_id = p_booking and status = 'pending_pickup';
  perform private.log_booking_event(p_booking, b.status, 'picked_up', p_actor,
                                    case when p_actor is null then 'system' else 'provider' end);
end $$;

create or replace function private.mark_completed(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  perform private.assert_booking_transition(b.status, 'completed');
  update bookings set status = 'completed', completed_at = now() where id = p_booking;
  perform private.log_booking_event(p_booking, b.status, 'completed', null, 'system');
end $$;

-- Calcolo penale con la versione di policy salvata nel booking (mai quella corrente)
create or replace function private.cancellation_fee_cents(p_booking uuid, p_side text, p_at timestamptz default now())
returns integer language plpgsql stable security definer set search_path = public as $$
declare b record; r jsonb; hours numeric; pct numeric; tier jsonb;
begin
  select bk.*, v.rules into b from bookings bk
    join cancellation_policy_versions v on v.id = bk.cancellation_policy_version_id
   where bk.id = p_booking;
  r := b.rules;
  if b.status in ('requested', 'accepted') then
    pct := coalesce((r ->> 'before_confirmation_fee_pct')::numeric, 0);
  elsif p_side = 'provider' then
    pct := 100 - coalesce((r ->> 'provider_cancel_refund_pct')::numeric, 100);
  else
    hours := extract(epoch from (b.pickup_at - p_at)) / 3600;
    pct := null;
    for tier in select * from jsonb_array_elements(r -> 'tiers') loop   -- ordinati per min_hours_before desc
      if hours >= (tier ->> 'min_hours_before')::numeric then
        pct := (tier ->> 'fee_pct')::numeric;
        exit;
      end if;
    end loop;
    pct := coalesce(pct, 100);
  end if;
  return round(b.total_cents * pct / 100)::integer;
end $$;

-- CANCELLAZIONE: restituisce l'importo da rimborsare. Il server esegue il refund Stripe e poi
-- conferma con private.mark_refund_succeeded.
create or replace function private.cancel_booking(p_booking uuid, p_actor uuid, p_side text, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  b record; p record;
  fee integer; refund integer; c_keep integer; n_keep integer;
  g uuid := gen_random_uuid();
begin
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_side = 'customer' and b.customer_id <> p_actor then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_side = 'provider' then
    perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager']::org_role[]);
  end if;
  perform private.assert_booking_transition(b.status, 'cancelled');

  fee := private.cancellation_fee_cents(p_booking, p_side);
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = p_side, cancel_reason = p_reason
   where id = p_booking;
  update unit_reservations set active = false where booking_id = p_booking;
  perform private.log_booking_event(p_booking, b.status, 'cancelled', p_actor, p_side, p_reason,
                                    jsonb_build_object('fee_cents', fee));

  if b.status in ('requested', 'accepted') then
    return 0;   -- niente incassato: il server rilascia la preautorizzazione
  end if;

  refund := b.total_cents - fee;
  c_keep := round(fee::numeric * b.commission_cents / b.total_cents)::integer;
  n_keep := fee - c_keep;

  select * into p from payments where booking_id = p_booking for update;
  if refund > 0 then
    insert into refunds (payment_id, booking_id, amount_cents, reason, policy_rule)
    values (p.id, p_booking, refund, 'cancellation_' || p_side, jsonb_build_object('fee_cents', fee));
    insert into ledger_entries (entry_group, booking_id, organization_id, account, amount_cents, description) values
      (g, p_booking, null, 'stripe_balance', -refund, 'Rimborso cancellazione'),
      (g, p_booking, null, 'platform_revenue', b.commission_cents - c_keep, 'Storno commissione'),
      (g, p_booking, b.organization_id, 'provider_payable', b.provider_net_cents - n_keep, 'Storno netto provider');
  end if;

  update payouts set amount_cents = n_keep,
                     status = case when n_keep = 0 then 'reversed'::payout_status else 'scheduled'::payout_status end,
                     scheduled_for = now() + interval '24 hours'
   where booking_id = p_booking and status in ('pending_pickup', 'scheduled');
  return refund;
end $$;

create or replace function private.mark_no_show(p_booking uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  perform private.assert_booking_transition(b.status, 'no_show');
  if now() < b.pickup_at + interval '2 hours' then raise exception 'TOO_EARLY' using errcode = 'P0001'; end if;
  update bookings set status = 'no_show' where id = p_booking;
  update unit_reservations set active = false where booking_id = p_booking;
  update payouts set status = 'scheduled', scheduled_for = now() + interval '24 hours'
   where booking_id = p_booking and status = 'pending_pickup';
  perform private.log_booking_event(p_booking, b.status, 'no_show', p_actor, 'provider');
end $$;

-- JOB: scadenze. Restituisce i booking scaduti (il server annulla le preautorizzazioni).
create or replace function private.expire_stale_bookings()
returns setof uuid language plpgsql security definer set search_path = public as $$
declare b record;
begin
  for b in
    select id, status from bookings
     where (status = 'requested' and provider_response_due_at < now())
        or (status = 'accepted' and customer_confirm_due_at < now())
     for update skip locked
  loop
    update bookings set status = 'expired' where id = b.id;
    update unit_reservations set active = false where booking_id = b.id;
    perform private.log_booking_event(b.id, b.status, 'expired', null, 'system');
    return next b.id;
  end loop;
  update unit_reservations set active = false where active and kind = 'hold' and expires_at < now();
end $$;

-- JOB: payout dovuti. Li segna 'processing' (nessun altro worker li prende), il server chiama Stripe.
create or replace function private.claim_due_payouts(p_limit integer default 50)
returns setof public.payouts language sql security definer set search_path = public as $$
  update payouts set status = 'processing'
   where id in (
     select po.id from payouts po
       join payments pa on pa.booking_id = po.booking_id
      where po.status = 'scheduled' and po.scheduled_for <= now() and po.amount_cents > 0
        and pa.status <> 'disputed'
      order by po.scheduled_for
      limit p_limit
      for update of po skip locked)
  returning *;
$$;

create or replace function private.mark_payout_paid(p_payout uuid, p_transfer_id text)
returns void language plpgsql security definer set search_path = public as $$
declare po record; g uuid := gen_random_uuid();
begin
  select * into po from payouts where id = p_payout for update;
  if po.status = 'paid' then return; end if;   -- idempotente
  if po.status <> 'processing' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  update payouts set status = 'paid', stripe_transfer_id = p_transfer_id where id = p_payout;
  insert into ledger_entries (entry_group, booking_id, organization_id, account, amount_cents, description) values
    (g, po.booking_id, po.organization_id, 'provider_payable', po.amount_cents, 'Payout al provider'),
    (g, po.booking_id, null, 'stripe_balance', -po.amount_cents, 'Transfer Stripe ' || p_transfer_id);
end $$;

create or replace function private.mark_payout_failed(p_payout uuid, p_reason text)
returns void language sql security definer set search_path = public as $$
  update payouts set status = 'failed', failure_reason = p_reason where id = p_payout and status = 'processing';
$$;

create or replace function private.mark_refund_succeeded(p_refund uuid, p_stripe_refund text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from refunds where id = p_refund for update;
  if r.status = 'succeeded' then return; end if;
  update refunds set status = 'succeeded', stripe_refund_id = p_stripe_refund where id = p_refund;
  update payments set refunded_cents = refunded_cents + r.amount_cents,
                      status = case when refunded_cents + r.amount_cents >= captured_cents
                                    then 'refunded'::payment_status else 'partially_refunded'::payment_status end
   where id = r.payment_id;
end $$;

-- Webhook Stripe: registra l'evento una sola volta. true = nuovo, da processare.
create or replace function private.register_stripe_event(p_event_id text, p_type text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into stripe_events (event_id, type, payload) values (p_event_id, p_type, p_payload);
  return true;
exception when unique_violation then
  return false;
end $$;

create or replace function private.mark_payment_disputed(p_payment_intent text)
returns void language sql security definer set search_path = public as $$
  update payments set status = 'disputed' where stripe_payment_intent_id = p_payment_intent;
  update payouts set status = 'on_hold'
   where booking_id = (select booking_id from payments where stripe_payment_intent_id = p_payment_intent)
     and status in ('pending_pickup', 'scheduled', 'failed');
$$;
