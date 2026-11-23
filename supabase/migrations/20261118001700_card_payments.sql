-- KeyRent · 0017 · Pagamento con carta: blocco alla richiesta, addebito quando il noleggiatore accetta
alter table public.bookings add column if not exists payment_required boolean not null default false;
alter table public.bookings add column if not exists payment_ready boolean not null default false;
alter table public.bookings add column if not exists stripe_payment_intent_id text unique;

-- Notifiche: in alcuni passaggi interni il server le tace (richiesta non ancora pagata, accettazione + addebito)
create or replace function private.on_booking_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare b record; payload jsonb;
begin
  if coalesce(current_setting('keyrent.silent', true), '') = 'on' then return null; end if;
  select id, code, customer_id, organization_id, pickup_at into b from bookings where id = new.booking_id;
  payload := jsonb_build_object('booking_id', b.id, 'code', b.code, 'status', new.to_status);
  case new.to_status
    when 'requested' then perform private.notify_org(b.organization_id, 'booking_requested', payload);
    when 'accepted'  then perform private.notify(b.customer_id, 'booking_accepted', payload);
    when 'declined'  then perform private.notify(b.customer_id, 'booking_declined', payload);
    when 'expired'   then perform private.notify(b.customer_id, 'booking_expired', payload);
                          perform private.notify_org(b.organization_id, 'booking_expired', payload);
    when 'confirmed' then perform private.notify(b.customer_id, 'booking_confirmed', payload);
                          perform private.notify_org(b.organization_id, 'booking_confirmed', payload);
    when 'cancelled' then perform private.notify(b.customer_id, 'booking_cancelled', payload);
                          perform private.notify_org(b.organization_id, 'booking_cancelled', payload);
    else null;
  end case;
  return null;
end $$;

-- 1) Richiesta da pagare: il noleggiatore non la vede finché la carta non è bloccata (max 30 minuti)
create or replace function public.svc_create_paid_booking_request(p_customer uuid, p_listing uuid, p_pickup timestamptz,
  p_return timestamptz, p_driver jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v uuid;
begin
  -- prima libera le richieste mai pagate (così non bloccano le date)
  perform private.expire_unpaid_requests();
  perform set_config('keyrent.silent', 'on', true);
  v := private.create_booking_request(p_customer, p_listing, p_pickup, p_return, '[]'::jsonb, p_driver);
  perform set_config('keyrent.silent', 'off', true);
  update bookings set payment_required = true where id = v;
  update unit_reservations set expires_at = least(expires_at, now() + interval '30 minutes') where booking_id = v and active;
  return v;
end $$;

create or replace function public.svc_set_payment_intent(p_booking uuid, p_customer uuid, p_pi text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update bookings set stripe_payment_intent_id = p_pi
   where id = p_booking and customer_id = p_customer and status = 'requested' and payment_required
     and (stripe_payment_intent_id is null or stripe_payment_intent_id = p_pi);
  if not found then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
end $$;

-- 2) Carta bloccata (dal server dopo la verifica su Stripe, o dal webhook): ora la richiesta arriva al noleggiatore
create or replace function public.svc_payment_authorized(p_booking uuid, p_pi text, p_amount integer)
returns void language plpgsql security invoker set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.stripe_payment_intent_id is distinct from p_pi then raise exception 'PAYMENT_MISMATCH' using errcode = 'P0001'; end if;
  if b.payment_ready then return; end if;   -- idempotente
  if b.status <> 'requested' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  perform private.record_authorization(p_booking, p_pi, p_amount);
  if not exists (select 1 from payments where booking_id = p_booking and stripe_payment_intent_id = p_pi) then
    raise exception 'PAYMENT_MISMATCH' using errcode = 'P0001';
  end if;
  if not exists (select 1 from unit_reservations where booking_id = p_booking and active) then
    raise exception 'HOLD_LOST' using errcode = 'P0001';
  end if;
  update unit_reservations set expires_at = b.provider_response_due_at where booking_id = p_booking and active;
  update bookings set payment_ready = true where id = p_booking;
  perform private.notify_org(b.organization_id, 'booking_requested',
    jsonb_build_object('booking_id', b.id, 'code', b.code, 'status', 'requested'));
end $$;

-- Richieste mai pagate: scadono in silenzio dopo 30 minuti
create or replace function private.expire_unpaid_requests()
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  perform set_config('keyrent.silent', 'on', true);
  for b in select id from bookings
            where status = 'requested' and payment_required and not payment_ready and created_at < now() - interval '30 minutes'
            for update skip locked loop
    update bookings set status = 'expired', cancel_reason = 'pagamento non completato' where id = b.id;
    update unit_reservations set active = false where booking_id = b.id;
    perform private.log_booking_event(b.id, 'requested', 'expired', null, 'system');
  end loop;
  perform set_config('keyrent.silent', 'off', true);
end $$;

-- 3) Il noleggiatore accetta: prima si verifica (in silenzio), poi il server addebita, poi si conferma
create or replace function public.svc_accept_paid_booking(p_booking uuid, p_actor uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking;
  if not found or not b.payment_ready then raise exception 'PAYMENT_MISSING' using errcode = 'P0001'; end if;
  perform set_config('keyrent.silent', 'on', true);
  perform private.accept_booking(p_booking, p_actor);
  perform set_config('keyrent.silent', 'off', true);
  return b.stripe_payment_intent_id;
end $$;

create or replace function public.svc_confirm_paid_booking(p_booking uuid, p_actor uuid, p_pi text, p_captured integer)
returns void language plpgsql security invoker set search_path = public as $$
declare b record; p record; g uuid := gen_random_uuid();
begin
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if b.status in ('confirmed', 'picked_up', 'completed') then return; end if;   -- idempotente
  perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  perform private.assert_booking_transition(b.status, 'confirmed');
  select * into p from payments where booking_id = p_booking for update;
  if not found or p.stripe_payment_intent_id <> p_pi then raise exception 'PAYMENT_MISMATCH' using errcode = 'P0001'; end if;
  if p_captured <> b.total_cents then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;
  update payments set status = 'captured', captured_at = now(), captured_cents = p_captured where id = p.id;
  update unit_reservations set kind = 'booking', expires_at = null where booking_id = p_booking and active;
  update bookings set status = 'confirmed', confirmed_at = now() where id = p_booking;
  insert into ledger_entries (entry_group, booking_id, organization_id, account, amount_cents, description) values
    (g, p_booking, null, 'stripe_balance', b.total_cents, 'Incasso prenotazione ' || b.code),
    (g, p_booking, null, 'platform_revenue', -b.commission_cents, 'Commissione KeyRent'),
    (g, p_booking, b.organization_id, 'provider_payable', -b.provider_net_cents, 'Netto provider in attesa del ritiro');
  insert into payouts (booking_id, organization_id, amount_cents, status, scheduled_for)
  values (p_booking, b.organization_id, b.provider_net_cents, 'pending_pickup', b.pickup_at + interval '24 hours');
  perform private.log_booking_event(p_booking, b.status, 'confirmed', p_actor, 'provider');
end $$;

-- Addebito non riuscito: la prenotazione si annulla (cliente e noleggiatore avvisati)
create or replace function public.svc_payment_failed(p_booking uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('requested', 'accepted') then return; end if;
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'system', cancel_reason = 'pagamento non riuscito' where id = p_booking;
  update unit_reservations set active = false where booking_id = p_booking;
  update payments set status = 'failed' where booking_id = p_booking and status = 'authorized';
  perform private.log_booking_event(p_booking, b.status, 'cancelled', null, 'system', 'pagamento non riuscito');
end $$;

-- Stato pagamento da Stripe (webhook / rilasci) · rimborsi · eventi
create or replace function public.svc_payment_canceled(p_pi text)
returns void language sql security invoker set search_path = public as $$
  update payments set status = 'canceled' where stripe_payment_intent_id = p_pi and status = 'authorized';
$$;
create or replace function public.svc_mark_refund_succeeded(p_refund uuid, p_stripe_refund text)
returns void language sql security invoker set search_path = public as $$ select private.mark_refund_succeeded(p_refund, p_stripe_refund); $$;
create or replace function public.svc_register_stripe_event(p_event_id text, p_type text, p_payload jsonb)
returns boolean language sql security invoker set search_path = public as $$ select private.register_stripe_event(p_event_id, p_type, p_payload); $$;
create or replace function public.svc_mark_payment_disputed(p_pi text)
returns void language sql security invoker set search_path = public as $$ select private.mark_payment_disputed(p_pi); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.svc_create_paid_booking_request(uuid, uuid, timestamptz, timestamptz, jsonb)',
    'public.svc_set_payment_intent(uuid, uuid, text)', 'public.svc_payment_authorized(uuid, text, integer)',
    'public.svc_accept_paid_booking(uuid, uuid)', 'public.svc_confirm_paid_booking(uuid, uuid, text, integer)',
    'public.svc_payment_failed(uuid)', 'public.svc_payment_canceled(text)', 'public.svc_mark_refund_succeeded(uuid, text)',
    'public.svc_register_stripe_event(text, text, jsonb)', 'public.svc_mark_payment_disputed(text)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function private.expire_unpaid_requests() from public, anon, authenticated;
grant execute on function private.expire_unpaid_requests() to service_role;

-- Scadenze per il server: richieste mai pagate (in silenzio) + scadenze normali (restituisce le prenotazioni scadute)
create or replace function public.svc_expire_all()
returns setof uuid language plpgsql security invoker set search_path = public as $$
begin
  perform private.expire_unpaid_requests();
  return query select * from private.expire_stale_bookings();
end $$;
revoke execute on function public.svc_expire_all() from public, anon, authenticated;
grant execute on function public.svc_expire_all() to service_role;

-- Contatori: le richieste non ancora pagate non contano per il noleggiatore
create or replace function public.my_badges()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  orgs as (select organization_id from organization_members m, me where m.user_id = me.uid and m.status = 'active'),
  staff as (select exists (select 1 from staff_members s, me where s.user_id = me.uid and s.active) as yes),
  convs as (
    select c.id, case when c.customer_id = (select uid from me) then 'customer' else 'provider' end as side
    from conversations c
    where c.customer_id = (select uid from me) or c.organization_id in (select organization_id from orgs)
  )
  select jsonb_build_object(
    'messages', (select count(*) from messages ms
                   join convs c on c.id = ms.conversation_id
                   left join conversation_reads r on r.conversation_id = ms.conversation_id and r.user_id = (select uid from me)
                  where ms.sender_side <> c.side and ms.filter_result <> 'blocked'
                    and ms.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
    'requests', (select count(*) from bookings b
                  where b.organization_id in (select organization_id from orgs)
                    and b.status = 'requested' and b.provider_response_due_at > now()
                    and (not b.payment_required or b.payment_ready)),
    'provider_bookings', (select count(*) from notifications n
                           where n.user_id = (select uid from me) and n.read_at is null
                             and n.type in ('booking_confirmed', 'booking_cancelled', 'booking_expired')
                             and exists (select 1 from bookings b where b.id = (n.payload ->> 'booking_id')::uuid
                                           and b.organization_id in (select organization_id from orgs))),
    'customer_bookings', (select count(*) from notifications n
                           where n.user_id = (select uid from me) and n.read_at is null
                             and n.type in ('booking_accepted', 'booking_declined', 'booking_expired', 'booking_confirmed', 'booking_cancelled')
                             and exists (select 1 from bookings b where b.id = (n.payload ->> 'booking_id')::uuid
                                           and b.customer_id = (select uid from me))),
    'listings_to_fix', (select count(*) from listings l
                         where l.organization_id in (select organization_id from orgs) and l.status = 'changes_required'),
    'admin_reviews', case when (select yes from staff) then (select count(*) from listing_revisions where status = 'pending_review') else 0 end,
    'admin_orgs', case when (select yes from staff) then (select count(*) from organizations where verification_status = 'pending') else 0 end
  )
$$;
