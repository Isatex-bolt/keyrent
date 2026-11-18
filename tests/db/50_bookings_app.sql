-- Funzioni 0008: prenotazioni e conversazioni viste dall'app
\set ON_ERROR_STOP 1
select date_trunc('day', now()) + interval '120 days 10 hours' as p, date_trunc('day', now()) + interval '122 days 10 hours' as r \gset

set role service_role;
select public.svc_create_booking_request('c0000000-0000-0000-0000-000000000002', '3b000000-0000-0000-0000-000000000001',
  :'p', :'r', '[]', '{"first_name":"Luca","last_name":"Bianchi"}') as bk \gset
select test.fails(format($$select public.svc_accept_booking(%L, %L)$$, :'bk', 'a0000000-0000-0000-0000-000000000001'),
                  'FORBIDDEN', 'un altro provider non accetta la richiesta');
reset role;

set role authenticated;
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
select test.ok((select listing_title = 'Lamborghini Urus' and status = 'requested' and city = 'Vicenza' from public.my_bookings(:'bk')),
               'il cliente vede titolo, stato e città della propria richiesta');
select test.ok(not exists (select 1 from information_schema.routines r where r.routine_name = 'my_bookings'
                 and r.data_type ilike '%address%'), 'my_bookings non espone indirizzi');
select test.fails($$select public.svc_accept_booking(gen_random_uuid(), gen_random_uuid())$$, 'permission denied',
                  'il browser non può accettare prenotazioni');
select public.start_conversation('3b000000-0000-0000-0000-000000000001', 'È disponibile il seggiolino?') as conv \gset
select test.ok((select my_side = 'customer' and other_label = 'Noleggiatore verificato · Vicenza' from public.my_conversations(:'conv')),
               'il cliente vede il noleggiatore come "verificato + città"');
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select test.ok((select count(*) = 0 from public.my_bookings(:'bk')), 'un altro cliente non vede la prenotazione');
select test.ok((select count(*) = 0 from public.my_conversations(:'conv')), 'un altro cliente non vede la conversazione');
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.ok((select my_side = 'provider' and last_message = 'È disponibile il seggiolino?' from public.my_conversations(:'conv')),
               'il noleggiatore vede la conversazione e l''ultimo messaggio');
select test.ok((select driver ->> 'first_name' = 'Luca' from bookings where id = :'bk'), 'il noleggiatore vede i dati del conducente');
reset role; reset request.jwt.claim.sub;

set role service_role;
select public.svc_accept_booking(:'bk', 'b0000000-0000-0000-0000-000000000001');
select test.ok((select status = 'accepted' from bookings where id = :'bk'), 'il noleggiatore accetta tramite il server');
select test.ok(public.svc_cancel_booking(:'bk', 'c0000000-0000-0000-0000-000000000002', 'customer', 'test') = 0,
               'cancellazione prima della conferma: nessuna penale');
select test.ok((select count(*) = 0 from public.svc_expire_stale_bookings() x), 'nessuna richiesta scaduta da chiudere');
reset role;
