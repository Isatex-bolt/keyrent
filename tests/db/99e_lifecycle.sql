-- 0024: consegnato, rientrato, non presentato · blocchi del noleggiatore
\set ON_ERROR_STOP 1
select date_trunc('day', now()) + interval '300 days 10 hours' as p, date_trunc('day', now()) + interval '302 days 10 hours' as r \gset
\set urus '\'3b000000-0000-0000-0000-000000000001\''
\set cli '\'c0000000-0000-0000-0000-000000000002\''
\set owner '\'b0000000-0000-0000-0000-000000000001\''
\set other '\'a0000000-0000-0000-0000-000000000001\''

set role service_role;
select public.svc_create_paid_booking_request(:cli, :urus, :'p', :'r', '{}') as bk \gset
select public.svc_set_payment_intent(:'bk', :cli, 'pi_life_1');
select public.svc_payment_authorized(:'bk', 'pi_life_1', (select total_cents from bookings where id = :'bk'));
select public.svc_accept_paid_booking(:'bk', :owner);
select public.svc_confirm_paid_booking(:'bk', :owner, 'pi_life_1', (select total_cents from bookings where id = :'bk'));
select test.fails(format('select public.svc_mark_picked_up(%L, %L)', :'bk', 'b0000000-0000-0000-0000-000000000001'), 'TOO_EARLY', 'consegna troppo presto: rifiutata');
reset role;
update bookings set pickup_at = now() - interval '1 hour' where id = :'bk';
set role service_role;
select test.fails(format('select public.svc_mark_picked_up(%L, %L)', :'bk', 'a0000000-0000-0000-0000-000000000001'), 'FORBIDDEN', 'un altro noleggiatore non segna la consegna');
select public.svc_mark_picked_up(:'bk', :owner);
reset role;
select test.ok((select status = 'picked_up' from bookings where id = :'bk')
  and (select status = 'scheduled' from payouts where booking_id = :'bk'), 'consegnato: in corso, versamento programmato');
set role service_role;
select test.fails(format('select public.svc_mark_returned(%L, %L)', :'bk', 'c0000000-0000-0000-0000-000000000002'), 'FORBIDDEN', 'il cliente non segna il rientro');
select public.svc_mark_returned(:'bk', :owner);
reset role;
select test.ok((select status = 'completed' from bookings where id = :'bk'), 'rientrato: noleggio concluso');
set role authenticated;
select test.fails(format('select public.svc_mark_returned(%L, %L)', :'bk', 'b0000000-0000-0000-0000-000000000001'), 'permission denied', 'dal browser non si chiamano');
reset role;

-- blocchi: il noleggiatore blocca giorni liberi, non quelli già prenotati, e non i mezzi di altri
select vehicle_unit_id as unit from listing_units where listing_id = :urus limit 1 \gset
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', false);
set role authenticated;
insert into unit_reservations (vehicle_unit_id, period, kind, note)
values (:'unit', tstzrange(:'p'::timestamptz + interval '20 days', :'p'::timestamptz + interval '22 days', '[)'), 'block', 'noleggio esterno');
reset role;
select test.ok((select count(*) = 1 from unit_reservations where vehicle_unit_id = :'unit' and kind = 'block' and active), 'blocco creato dal noleggiatore');
set role service_role;
select test.fails(format('select public.svc_create_paid_booking_request(%L, %L, %L, %L, %L)', 'c0000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000001',
  (:'p'::timestamptz + interval '20 days')::text, (:'p'::timestamptz + interval '22 days')::text, '{}'), 'NOT_AVAILABLE', 'giorni bloccati: non prenotabili');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
set role authenticated;
select test.fails(format($$insert into unit_reservations (vehicle_unit_id, period, kind) values (%L, tstzrange(now() + interval '400 days', now() + interval '401 days'), 'block')$$, :'unit'),
  'row-level security', 'un altro noleggiatore non blocca i mezzi altrui');
reset role; reset request.jwt.claim.sub;
