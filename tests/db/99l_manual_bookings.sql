-- Prenotazioni manuali (telefono / banco)

\set bike '''3a000000-0000-0000-0000-000000000002'''
\set owner '''a0000000-0000-0000-0000-000000000001'''
\set ownerB '''b0000000-0000-0000-0000-000000000001'''
select (date_trunc('day', now()) + interval '140 days 10 hours') as p1, (date_trunc('day', now()) + interval '141 days 10 hours') as r1 \gset

-- bici in pool da 3 unità: due manuali + una online occupano tutto, la quarta richiesta è rifiutata
select public.svc_manual_create(:owner, :bike, :'p1', :'r1', 'Mario Rossi', '333 1112222', 3500, 'Pagato al banco') as m1 \gset
select public.svc_manual_create(:owner, :bike, :'p1', :'r1', 'Luca Verdi', null, 0, null) as m2 \gset
select test.ok((select count(*) from unit_reservations where kind = 'external' and active) = 2, 'due prenotazioni manuali occupano due unità');
select private.create_booking_request('c0000000-0000-0000-0000-000000000001', :bike, :'p1', :'r1') as b1 \gset
select test.ok(:'b1' is not null, 'la prenotazione online prende l''ultima unità');
select test.fails(format($$ select public.svc_manual_create('a0000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000002', %L, %L, 'Terzo', null, 0, null) $$, :'p1', :'r1'),
  'NOT_AVAILABLE', 'manuale sull''unità già presa online: rifiutata');
select test.fails(format($$ select private.create_booking_request('c0000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000002', %L, %L) $$, :'p1', :'r1'),
  'NOT_AVAILABLE', 'online quando le manuali hanno preso il resto: rifiutata');

-- modifica in conflitto: resta l'originale
select (date_trunc('day', now()) + interval '160 days 10 hours') as p2, (date_trunc('day', now()) + interval '161 days 10 hours') as r2 \gset
select public.svc_manual_create(:owner, :bike, :'p2', :'r2', 'A', null, 0, null), public.svc_manual_create(:owner, :bike, :'p2', :'r2', 'B', null, 0, null),
       public.svc_manual_create(:owner, :bike, :'p2', :'r2', 'C', null, 0, null) \gset x_
select test.fails(format($$ select public.svc_manual_update('a0000000-0000-0000-0000-000000000001', %L, null, %L, %L, 'Mario Rossi', null, 3500, null) $$, :'m1', :'p2', :'r2'),
  'NOT_AVAILABLE', 'modifica su date piene: rifiutata');
select test.ok((select pickup_at = :'p1'::timestamptz and status = 'active' from manual_bookings where id = :'m1')
  and exists (select 1 from unit_reservations r join manual_bookings m on m.reservation_id = r.id where m.id = :'m1' and r.active),
  'dopo il conflitto resta la prenotazione originale con il suo mezzo');

-- modifica riuscita e annullamento che libera il mezzo
select (date_trunc('day', now()) + interval '170 days 9 hours') as p3, (date_trunc('day', now()) + interval '170 days 18 hours') as r3 \gset
select public.svc_manual_update(:owner, :'m1', null, :'p3', :'r3', 'Mario Rossi', '333', 4000, 'spostata');
select test.ok((select price_cents = 4000 and pickup_at = :'p3'::timestamptz from manual_bookings where id = :'m1'), 'modifica salvata');
select public.svc_manual_cancel(:owner, :'m2');
select test.ok(not exists (select 1 from unit_reservations r join manual_bookings m on m.reservation_id = r.id where m.id = :'m2' and r.active),
  'annullamento: il mezzo torna libero');
select test.ok(private.create_booking_request('c0000000-0000-0000-0000-000000000002', :bike, :'p1', :'r1') is not null, 'e si può riprenotare online');
select test.ok(not exists (select 1 from payments p join bookings b on b.id = p.booking_id where b.listing_id = :bike and b.created_at > now() - interval '1 minute' and p.status = 'captured'),
  'nessun pagamento dalle manuali');

-- chi vede e chi modifica
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
set role authenticated;
select test.ok((select count(*) from manual_bookings) = 0, 'un''altra attività non vede i clienti manuali');
select test.fails($$ insert into manual_bookings (organization_id, listing_id, customer_name, pickup_at, return_at) values ('0a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000002', 'x', now(), now() + interval '1 day') $$,
  '42501|permission', 'nessuno scrive dal client');
reset role;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
set role authenticated;
select test.ok((select count(*) from manual_bookings) >= 5, 'il noleggiatore vede le sue');
reset role; reset request.jwt.claim.sub;
select test.fails(format($$ select public.svc_manual_cancel('b0000000-0000-0000-0000-000000000001', %L) $$, :'m1'), 'FORBIDDEN', 'un''altra attività non annulla');
select test.fails(format($$ select public.svc_manual_update('b0000000-0000-0000-0000-000000000001', %L, null, now() + interval '180 days', now() + interval '181 days', 'x', null, 0, null) $$, :'m1'), 'FORBIDDEN', 'un''altra attività non modifica');

-- pulizia
update unit_reservations set active = false where kind in ('external', 'hold') and vehicle_unit_id in (select vehicle_unit_id from listing_units where listing_id = :bike);
delete from manual_bookings;
