-- 0035 · Prenotazioni manuali (telefono / banco) nel calendario del noleggiatore.
-- Occupano la disponibilità con lo stesso meccanismo delle prenotazioni online (unit_reservations, kind 'external',
-- vincolo di non sovrapposizione): se competono per l'ultima unità ne passa una sola. Nessun pagamento, commissione o accredito.
-- I dati del cliente esterno li vedono solo i membri dell'attività (e lo staff KeyRent). Rieseguibile.
create table if not exists public.manual_bookings (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique default ('MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  listing_id       uuid not null references public.listings(id) on delete cascade,
  vehicle_unit_id  uuid references public.vehicle_units(id) on delete set null,
  reservation_id   uuid references public.unit_reservations(id) on delete set null,
  customer_name    text not null check (length(trim(customer_name)) between 1 and 120),
  customer_contact text check (length(customer_contact) <= 160),
  pickup_at        timestamptz not null,
  return_at        timestamptz not null,
  price_cents      integer not null default 0 check (price_cents between 0 and 100000000),
  note             text check (length(note) <= 1000),
  status           text not null default 'active' check (status in ('active', 'cancelled')),
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (return_at > pickup_at)
);
create index if not exists manual_bookings_org_idx on public.manual_bookings(organization_id, pickup_at);
revoke all on public.manual_bookings from anon, authenticated;
alter table public.manual_bookings enable row level security;
grant select on public.manual_bookings to authenticated;
drop policy if exists manual_bookings_read on public.manual_bookings;
create policy manual_bookings_read on public.manual_bookings for select to authenticated
  using (private.is_org_member(organization_id) or private.is_staff());

-- Occupa un'unità libera del mezzo (come le prenotazioni online). Restituisce la riga di disponibilità.
create or replace function private.manual_reserve(p_listing uuid, p_pickup timestamptz, p_return timestamptz, p_actor uuid, p_note text)
returns table (unit_id uuid, reservation_id uuid) language plpgsql security definer set search_path = public as $$
declare u record; v_until timestamptz; v_res uuid;
begin
  select p_return + make_interval(mins => coalesce(t.buffer_minutes, 0)) into v_until from rental_terms t where t.listing_id = p_listing;
  v_until := coalesce(v_until, p_return);
  for u in
    select vu.id from listing_units lu join vehicle_units vu on vu.id = lu.vehicle_unit_id
     where lu.listing_id = p_listing and vu.operational_status = 'active' order by vu.id
  loop
    update unit_reservations set active = false where vehicle_unit_id = u.id and active and kind = 'hold' and expires_at < now();
    begin
      insert into unit_reservations (vehicle_unit_id, period, kind, note, created_by)
      values (u.id, tstzrange(p_pickup, v_until, '[)'), 'external', p_note, p_actor) returning id into v_res;
      unit_id := u.id; reservation_id := v_res;
      return next; return;
    exception when exclusion_violation then null;  -- unità occupata: prova la successiva
    end;
  end loop;
  raise exception 'NOT_AVAILABLE: date non disponibili' using errcode = 'P0001';
end $$;

create or replace function public.svc_manual_create(p_actor uuid, p_listing uuid, p_pickup timestamptz, p_return timestamptz,
  p_name text, p_contact text, p_price_cents int, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l listings; r record; v_id uuid;
begin
  select * into l from listings where id = p_listing;
  if l.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform private.assert_member(l.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  if p_return <= p_pickup then raise exception 'BAD_DATES' using errcode = 'P0001'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_MISSING' using errcode = 'P0001'; end if;
  select * into r from private.manual_reserve(p_listing, p_pickup, p_return, p_actor, 'Manuale: ' || trim(p_name));
  insert into manual_bookings (organization_id, listing_id, vehicle_unit_id, reservation_id, customer_name, customer_contact,
                               pickup_at, return_at, price_cents, note, created_by)
  values (l.organization_id, p_listing, r.unit_id, r.reservation_id, trim(p_name), nullif(trim(p_contact), ''),
          p_pickup, p_return, greatest(coalesce(p_price_cents, 0), 0), nullif(trim(p_note), ''), p_actor)
  returning id into v_id;
  return v_id;
end $$;

-- Modifica: se le nuove date/il nuovo mezzo non sono liberi, l'errore annulla tutto e resta la prenotazione originale.
create or replace function public.svc_manual_update(p_actor uuid, p_id uuid, p_listing uuid, p_pickup timestamptz, p_return timestamptz,
  p_name text, p_contact text, p_price_cents int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare m manual_bookings; l listings; r record;
begin
  select * into m from manual_bookings where id = p_id for update;
  if m.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform private.assert_member(m.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  if m.status <> 'active' then raise exception 'CANCELLED' using errcode = 'P0001'; end if;
  select * into l from listings where id = coalesce(p_listing, m.listing_id);
  if l.organization_id is distinct from m.organization_id then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_return <= p_pickup then raise exception 'BAD_DATES' using errcode = 'P0001'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_MISSING' using errcode = 'P0001'; end if;
  update unit_reservations set active = false where id = m.reservation_id;
  select * into r from private.manual_reserve(l.id, p_pickup, p_return, p_actor, 'Manuale: ' || trim(p_name));
  update manual_bookings set listing_id = l.id, vehicle_unit_id = r.unit_id, reservation_id = r.reservation_id,
         customer_name = trim(p_name), customer_contact = nullif(trim(p_contact), ''), pickup_at = p_pickup, return_at = p_return,
         price_cents = greatest(coalesce(p_price_cents, 0), 0), note = nullif(trim(p_note), ''), updated_at = now()
   where id = p_id;
end $$;

create or replace function public.svc_manual_cancel(p_actor uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m manual_bookings;
begin
  select * into m from manual_bookings where id = p_id for update;
  if m.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform private.assert_member(m.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  update unit_reservations set active = false where id = m.reservation_id;
  update manual_bookings set status = 'cancelled', updated_at = now() where id = p_id;
end $$;

revoke all on function private.manual_reserve(uuid, timestamptz, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.svc_manual_create(uuid, uuid, timestamptz, timestamptz, text, text, int, text) from public, anon, authenticated;
revoke all on function public.svc_manual_update(uuid, uuid, uuid, timestamptz, timestamptz, text, text, int, text) from public, anon, authenticated;
revoke all on function public.svc_manual_cancel(uuid, uuid) from public, anon, authenticated;
grant execute on function private.manual_reserve(uuid, timestamptz, timestamptz, uuid, text) to service_role;
grant execute on function public.svc_manual_create(uuid, uuid, timestamptz, timestamptz, text, text, int, text) to service_role;
grant execute on function public.svc_manual_update(uuid, uuid, uuid, timestamptz, timestamptz, text, text, int, text) to service_role;
grant execute on function public.svc_manual_cancel(uuid, uuid) to service_role;
