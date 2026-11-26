-- 0036 · Pagamenti affidabili: addebito con esito incerto, recupero automatico, webhook "ricevuto ≠ completato",
-- rimborsi con stato reale, accrediti ai noleggiatori in stati espliciti, scadenze che non toccano un addebito in corso. Rieseguibile.

-- 1) ADDEBITO IN CORSO -----------------------------------------------------------------------------------------
alter table public.bookings add column if not exists capture_pending_since timestamptz;

-- Il noleggiatore accetta: si segna "addebito in corso" PRIMA di chiamare Stripe. Ripetere l'azione restituisce lo stesso pagamento.
create or replace function public.svc_accept_paid_booking(p_booking uuid, p_actor uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or not b.payment_ready then raise exception 'PAYMENT_MISSING' using errcode = 'P0001'; end if;
  if b.status = 'accepted' and b.capture_pending_since is not null then
    perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
    return b.stripe_payment_intent_id;   -- nuovo tentativo della stessa accettazione
  end if;
  perform set_config('keyrent.silent', 'on', true);
  perform private.accept_booking(p_booking, p_actor);
  perform set_config('keyrent.silent', 'off', true);
  update bookings set capture_pending_since = now() where id = p_booking;
  -- il mezzo resta bloccato finché l'esito dell'addebito non è certo
  update unit_reservations set expires_at = now() + interval '3 days' where booking_id = p_booking and active and kind = 'hold';
  return b.stripe_payment_intent_id;
end $$;

-- Conferma dopo addebito riuscito. p_actor nullo = recupero automatico (solo dal server). Idempotente.
create or replace function public.svc_confirm_paid_booking(p_booking uuid, p_actor uuid, p_pi text, p_captured integer)
returns void language plpgsql security invoker set search_path = public as $$
declare b record; p record; g uuid := gen_random_uuid();
begin
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if b.status in ('confirmed', 'picked_up', 'completed') then
    update bookings set capture_pending_since = null where id = p_booking and capture_pending_since is not null;
    return;
  end if;
  if p_actor is not null then
    perform private.assert_member(b.organization_id, p_actor, array['owner', 'manager', 'staff']::org_role[]);
  end if;
  perform private.assert_booking_transition(b.status, 'confirmed');
  select * into p from payments where booking_id = p_booking for update;
  if not found or p.stripe_payment_intent_id <> p_pi then raise exception 'PAYMENT_MISMATCH' using errcode = 'P0001'; end if;
  if p_captured <> b.total_cents then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;
  update payments set status = 'captured', captured_at = coalesce(captured_at, now()), captured_cents = p_captured where id = p.id;
  update unit_reservations set kind = 'booking', expires_at = null where booking_id = p_booking and active;
  update bookings set status = 'confirmed', confirmed_at = now(), capture_pending_since = null where id = p_booking;
  insert into ledger_entries (entry_group, booking_id, organization_id, account, amount_cents, description) values
    (g, p_booking, null, 'stripe_balance', b.total_cents, 'Incasso prenotazione ' || b.code),
    (g, p_booking, null, 'platform_revenue', -b.commission_cents, 'Commissione KeyRent'),
    (g, p_booking, b.organization_id, 'provider_payable', -b.provider_net_cents, 'Netto provider in attesa del ritiro');
  insert into payouts (booking_id, organization_id, amount_cents, status, scheduled_for)
  values (p_booking, b.organization_id, b.provider_net_cents, 'pending_pickup', b.pickup_at + interval '24 hours')
  on conflict (booking_id) do nothing;
  perform private.log_booking_event(p_booking, b.status, 'confirmed', p_actor, case when p_actor is null then 'system' else 'provider' end);
end $$;

-- Addebito rifiutato in modo DEFINITIVO (verificato su Stripe): si annulla. Mai chiamarla con esito incerto.
create or replace function public.svc_payment_failed(p_booking uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('requested', 'accepted') then return; end if;
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'system', cancel_reason = 'pagamento non riuscito',
                      capture_pending_since = null where id = p_booking;
  update unit_reservations set active = false where booking_id = p_booking;
  update payments set status = 'failed' where booking_id = p_booking and status = 'authorized';
  perform private.log_booking_event(p_booking, b.status, 'cancelled', null, 'system', 'pagamento non riuscito');
end $$;

-- Prenotazioni con addebito da verificare (per il recupero automatico)
create or replace function public.svc_pending_captures()
returns table (booking_id uuid, payment_intent text, total_cents integer, pending_since timestamptz)
language sql stable security invoker set search_path = public as $$
  select id, stripe_payment_intent_id, total_cents, capture_pending_since from bookings
   where capture_pending_since is not null and status = 'accepted' and stripe_payment_intent_id is not null
   order by capture_pending_since limit 50;
$$;

-- Carte ancora bloccate su prenotazioni chiuse (sblocco fallito o mai fatto): da sbloccare
create or replace function public.svc_holds_to_release()
returns table (booking_id uuid) language sql stable security invoker set search_path = public as $$
  select b.id from bookings b join payments p on p.booking_id = b.id
   where p.status = 'authorized' and b.status in ('expired', 'declined', 'cancelled') limit 50;
$$;

-- Niente cancellazioni mentre l'addebito è in corso: prima si aspetta l'esito certo di Stripe (poi si cancella con rimborso)
create or replace function public.svc_cancel_booking(p_booking uuid, p_actor uuid, p_side text, p_reason text default null)
returns integer language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from bookings where id = p_booking and capture_pending_since is not null) then
    raise exception 'CAPTURE_PENDING' using errcode = 'P0001';
  end if;
  return private.cancel_booking(p_booking, p_actor, p_side, p_reason);
end $$;

-- 2) SCADENZE: non toccano mai una prenotazione con addebito in corso --------------------------------------------
create or replace function private.expire_stale_bookings()
returns setof uuid language plpgsql security definer set search_path = public as $$
declare b record;
begin
  for b in
    select id, status from bookings
     where ((status = 'requested' and provider_response_due_at < now())
        or (status = 'accepted' and customer_confirm_due_at < now()))
       and capture_pending_since is null
     for update skip locked
  loop
    update bookings set status = 'expired' where id = b.id;
    update unit_reservations set active = false where booking_id = b.id;
    perform private.log_booking_event(b.id, b.status, 'expired', null, 'system');
    return next b.id;
  end loop;
  update unit_reservations r set active = false
   where r.active and r.kind = 'hold' and r.expires_at < now()
     and not exists (select 1 from bookings bk where bk.id = r.booking_id and bk.capture_pending_since is not null);
end $$;

-- 3) WEBHOOK: un evento è "fatto" solo quando l'elaborazione è riuscita ----------------------------------------
alter table public.stripe_events add column if not exists processing_started_at timestamptz;
alter table public.stripe_events add column if not exists attempts integer not null default 0;

-- 'process' = elaboralo tu; 'done' = già completato (duplicato); 'busy' = un altro invio lo sta elaborando ora
create or replace function public.svc_stripe_event_claim(p_event_id text, p_type text, p_payload jsonb)
returns text language plpgsql security invoker set search_path = public as $$
declare e record;
begin
  insert into stripe_events (event_id, type, payload) values (p_event_id, p_type, p_payload) on conflict (event_id) do nothing;
  update stripe_events set processing_started_at = now(), attempts = attempts + 1, error = null
   where event_id = p_event_id and processed_at is null
     and (processing_started_at is null or processing_started_at < now() - interval '2 minutes')
  returning * into e;
  if e.event_id is not null then return 'process'; end if;
  if exists (select 1 from stripe_events where event_id = p_event_id and processed_at is not null) then return 'done'; end if;
  return 'busy';
end $$;
create or replace function public.svc_stripe_event_done(p_event_id text)
returns void language sql security invoker set search_path = public as $$
  update stripe_events set processed_at = now(), processing_started_at = null, error = null where event_id = p_event_id;
$$;
create or replace function public.svc_stripe_event_failed(p_event_id text, p_error text)
returns void language sql security invoker set search_path = public as $$
  update stripe_events set processing_started_at = null, error = left(p_error, 500) where event_id = p_event_id and processed_at is null;
$$;

-- 4) RIMBORSI: stato reale di Stripe ---------------------------------------------------------------------------
alter table public.refunds add column if not exists stripe_status text;
alter table public.refunds add column if not exists failure_reason text;
alter table public.refunds add column if not exists updated_at timestamptz not null default now();

-- Aggiorna un rimborso con lo stato restituito da Stripe (succeeded / pending / requires_action / failed / canceled). Idempotente.
create or replace function public.svc_refund_update(p_refund uuid, p_stripe_refund text, p_status text, p_reason text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare r record;
begin
  select * into r from refunds where id = p_refund for update;
  if r.id is null or r.status <> 'pending' then return; end if;   -- già chiuso: niente doppie registrazioni
  if r.stripe_refund_id is not null and p_stripe_refund is distinct from r.stripe_refund_id then
    raise exception 'REFUND_MISMATCH' using errcode = 'P0001';
  end if;
  update refunds set stripe_refund_id = p_stripe_refund, stripe_status = p_status, updated_at = now() where id = p_refund;
  if p_status = 'succeeded' then
    perform private.mark_refund_succeeded(p_refund, p_stripe_refund);
  elsif p_status in ('failed', 'canceled') then
    update refunds set status = 'failed', failure_reason = coalesce(p_reason, p_status) where id = p_refund;
  end if;
end $$;
create or replace function public.svc_refund_by_stripe_id(p_stripe_refund text)
returns uuid language sql stable security invoker set search_path = public as $$
  select id from refunds where stripe_refund_id = p_stripe_refund;
$$;
-- Rimborsi da (ri)tentare o verificare: senza id Stripe = da creare; con id e ancora pendenti = da controllare
create or replace function public.svc_refunds_open()
returns table (refund_id uuid, booking_id uuid, amount_cents integer, stripe_refund_id text, payment_intent text)
language sql stable security invoker set search_path = public as $$
  select r.id, r.booking_id, r.amount_cents, r.stripe_refund_id, p.stripe_payment_intent_id
    from refunds r join payments p on p.id = r.payment_id
   where r.status = 'pending' and r.created_at > now() - interval '60 days'
   order by r.created_at limit 50;
$$;

-- 5) ACCREDITI AI NOLEGGIATORI (Stripe Connect Express, separate charges and transfers) -------------------------
alter table public.organizations add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.organizations add column if not exists stripe_details_submitted boolean not null default false;

create or replace function public.svc_org_stripe_account(p_org uuid, p_account text, p_payouts_enabled boolean, p_details boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update organizations set stripe_account_id = coalesce(p_account, stripe_account_id),
         stripe_payouts_enabled = p_payouts_enabled, stripe_details_submitted = p_details where id = p_org;
  -- appena il conto è pronto, gli accrediti in attesa del conto ripartono
  if p_payouts_enabled then
    update payouts set status = 'scheduled', failure_reason = null
     where organization_id = p_org and status = 'on_hold' and failure_reason = 'CONTO_NON_COLLEGATO';
  end if;
end $$;

-- Prende gli accrediti dovuti (nessun altro processo li prende: 'processing'). Senza conto pronto → on_hold esplicito.
create or replace function public.svc_claim_due_payouts(p_limit integer default 20)
returns table (payout_id uuid, booking_id uuid, organization_id uuid, amount_cents integer, stripe_account_id text, charge_ref text)
language plpgsql security invoker set search_path = public as $$
begin
  update payouts po set status = 'on_hold', failure_reason = 'CONTO_NON_COLLEGATO'
    from organizations o
   where o.id = po.organization_id and po.status = 'scheduled' and po.scheduled_for <= now()
     and not o.is_demo and (o.stripe_account_id is null or not o.stripe_payouts_enabled);
  return query
    select c.id, c.booking_id, c.organization_id, c.amount_cents, o.stripe_account_id, p.stripe_payment_intent_id
      from private.claim_due_payouts(p_limit) c
      join organizations o on o.id = c.organization_id
      join payments p on p.booking_id = c.booking_id;
end $$;
create or replace function public.svc_payout_paid(p_payout uuid, p_transfer text)
returns void language sql security invoker set search_path = public as $$ select private.mark_payout_paid(p_payout, p_transfer); $$;
create or replace function public.svc_payout_failed(p_payout uuid, p_reason text)
returns void language sql security invoker set search_path = public as $$ select private.mark_payout_failed(p_payout, left(p_reason, 300)); $$;
-- Accrediti rimasti 'processing' (processo interrotto): tornano in coda; il trasferimento ha chiave di idempotenza, quindi niente doppioni
create or replace function public.svc_payouts_unstick()
returns integer language sql security invoker set search_path = public as $$
  with u as (update payouts set status = 'scheduled' where status = 'processing' and updated_at < now() - interval '15 minutes' returning 1)
  select count(*)::integer from u;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.svc_accept_paid_booking(uuid, uuid)', 'public.svc_confirm_paid_booking(uuid, uuid, text, integer)',
    'public.svc_payment_failed(uuid)', 'public.svc_cancel_booking(uuid, uuid, text, text)', 'public.svc_pending_captures()', 'public.svc_holds_to_release()',
    'public.svc_stripe_event_claim(text, text, jsonb)', 'public.svc_stripe_event_done(text)', 'public.svc_stripe_event_failed(text, text)',
    'public.svc_refund_update(uuid, text, text, text)', 'public.svc_refund_by_stripe_id(text)', 'public.svc_refunds_open()',
    'public.svc_org_stripe_account(uuid, text, boolean, boolean)', 'public.svc_claim_due_payouts(integer)',
    'public.svc_payout_paid(uuid, text)', 'public.svc_payout_failed(uuid, text)', 'public.svc_payouts_unstick()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
