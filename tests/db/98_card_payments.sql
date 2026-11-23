-- 0017: richiesta con carta bloccata, addebito all'accettazione, richieste mai pagate
\set ON_ERROR_STOP 1
select date_trunc('day', now()) + interval '200 days 10 hours' as p, date_trunc('day', now()) + interval '202 days 10 hours' as r \gset
\set urus '\'3b000000-0000-0000-0000-000000000001\''
\set cli '\'c0000000-0000-0000-0000-000000000001\''
\set owner '\'b0000000-0000-0000-0000-000000000001\''
delete from notifications;

set role service_role;
select public.svc_create_paid_booking_request(:cli, :urus, :'p', :'r', '{}') as bk \gset
select test.ok((select count(*) = 0 from notifications where type = 'booking_requested'), 'richiesta non pagata: noleggiatore non avvisato');
select test.ok((select payment_required and not payment_ready from bookings where id = :'bk'), 'richiesta in attesa di pagamento');
select test.ok((select expires_at < now() + interval '31 minutes' from unit_reservations where booking_id = :'bk' and active), 'date bloccate solo 30 minuti');
select test.fails(format('select public.svc_accept_paid_booking(%L, %L)', :'bk', 'b0000000-0000-0000-0000-000000000001'),
  'PAYMENT_MISSING', 'non si accetta una richiesta non pagata');
select test.fails(format('select public.svc_set_payment_intent(%L, %L, %L)', :'bk', 'c0000000-0000-0000-0000-000000000002', 'pi_x'),
  'INVALID_STATE', 'un altro cliente non collega il pagamento');
select public.svc_set_payment_intent(:'bk', :cli, 'pi_card_1');
select test.fails(format('select public.svc_payment_authorized(%L, %L, 1)', :'bk', 'pi_card_1'), 'AMOUNT_MISMATCH', 'importo diverso rifiutato');
select public.svc_payment_authorized(:'bk', 'pi_card_1', (select total_cents from bookings where id = :'bk'));
select public.svc_payment_authorized(:'bk', 'pi_card_1', (select total_cents from bookings where id = :'bk'));
reset role;
select test.ok((select payment_ready from bookings where id = :'bk')
  and (select count(*) = 1 from payments where booking_id = :'bk' and status = 'authorized'), 'carta bloccata (una sola volta)');
set role service_role;
select test.ok((select count(*) > 0 from notifications where type = 'booking_requested' and payload ->> 'booking_id' = :'bk'), 'ora il noleggiatore è avvisato');
select test.ok((select expires_at > now() + interval '1 hour' from unit_reservations where booking_id = :'bk' and active), 'date bloccate fino alla risposta');
-- il noleggiatore accetta: verifica silenziosa, poi conferma dopo l'addebito
select test.ok(public.svc_accept_paid_booking(:'bk', :owner) = 'pi_card_1', 'accettazione restituisce il pagamento da addebitare');
select test.ok((select count(*) = 0 from notifications where type = 'booking_accepted' and payload ->> 'booking_id' = :'bk'), 'nessun avviso intermedio');
select public.svc_confirm_paid_booking(:'bk', :owner, 'pi_card_1', (select total_cents from bookings where id = :'bk'));
reset role;
select test.ok((select status = 'confirmed' from bookings where id = :'bk')
  and (select status = 'captured' from payments where booking_id = :'bk')
  and (select count(*) = 1 from payouts where booking_id = :'bk'), 'confermata, incassata, payout programmato');
select test.ok((select count(*) = 1 from notifications where type = 'booking_confirmed' and payload ->> 'booking_id' = :'bk'
  and user_id = :cli), 'cliente avvisato della conferma');
set role service_role;

-- richiesta mai pagata: dopo 30 minuti scade in silenzio e libera le date
select public.svc_create_paid_booking_request(:cli, :urus, (:'p'::timestamptz + interval '10 days'), (:'r'::timestamptz + interval '10 days'), '{}') as bk2 \gset
reset role;
update bookings set created_at = now() - interval '31 minutes' where id = :'bk2';
set role service_role;
select count(*) from public.svc_expire_all();
select test.ok((select status = 'expired' from bookings where id = :'bk2')
  and not exists (select 1 from unit_reservations where booking_id = :'bk2' and active), 'richiesta mai pagata scaduta, date libere');
select test.ok((select count(*) = 0 from notifications where type = 'booking_expired' and payload ->> 'booking_id' = :'bk2'), 'scadenza silenziosa');
-- addebito fallito: annullata e avvisati
select public.svc_create_paid_booking_request(:cli, :urus, (:'p'::timestamptz + interval '20 days'), (:'r'::timestamptz + interval '20 days'), '{}') as bk3 \gset
select public.svc_set_payment_intent(:'bk3', :cli, 'pi_card_3');
select public.svc_payment_authorized(:'bk3', 'pi_card_3', (select total_cents from bookings where id = :'bk3'));
select public.svc_accept_paid_booking(:'bk3', :owner);
select public.svc_payment_failed(:'bk3');
select test.ok((select status = 'cancelled' and cancelled_by = 'system' from bookings where id = :'bk3'), 'addebito fallito: prenotazione annullata');
reset role;
set role authenticated;
select test.fails($$select public.svc_payment_authorized(gen_random_uuid(), 'x', 1)$$, 'permission denied', 'il browser non segna pagamenti');
reset role;
