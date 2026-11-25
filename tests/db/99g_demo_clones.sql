-- 0027: demo personale per ogni visitatore (copia isolata, nascosta dal sito pubblico, cancellata dopo 24 ore)
\set ON_ERROR_STOP 1
\set urus '\'3b000000-0000-0000-0000-000000000001\''
\set orgB '\'0b000000-0000-0000-0000-000000000001\''
update organizations set is_demo = true where id = :orgB;
update listings set demo_keep = true where id = :urus;
insert into auth.users (id, email) values ('dd900000-0000-0000-0000-0000000000f2', 'prova.due@demo.keyrent.it') on conflict do nothing;
insert into auth.users (id, email) values ('ee000000-0000-0000-0000-000000000001', 'visitatore1@prova.keyrent.it'),
                                          ('ee000000-0000-0000-0000-000000000002', 'visitatore2@prova.keyrent.it');

set role service_role;
select public.svc_demo_clone('ee000000-0000-0000-0000-000000000001') as c1 \gset
select public.svc_demo_clone('ee000000-0000-0000-0000-000000000002') as c2 \gset
reset role;
select test.ok(:'c1' <> :'c2', 'due visitatori: due copie diverse');
select test.ok((select count(*) = 1 from listings where organization_id = :'c1' and demo_keep and demo_source_id = :urus), 'la copia ha i suoi annunci di esempio');
select test.ok((select count(*) > 0 from listing_media m join listings l on l.id = m.listing_id where l.organization_id = :'c1'), 'stesse foto');
select test.ok((select count(*) >= 3 from bookings where organization_id = :'c1'), 'noleggi finti nella copia');
select test.ok(not exists (select 1 from public_listings p join listings l on l.id = p.id where l.organization_id in (:'c1', :'c2')),
  'le copie non compaiono sul sito pubblico');
select test.ok(exists (select 1 from public_listings where id = :urus), 'l''originale resta pubblico');
-- un annuncio nuovo creato in una demo (non di esempio) non va sul sito pubblico
update listings set demo_keep = false where organization_id = :'c1';
select test.ok(not exists (select 1 from public_listings p join listings l on l.id = p.id where l.organization_id = :'c1'),
  'annunci creati provando la demo: non pubblici');
update listings set demo_keep = true where organization_id = :'c1';

-- isolamento: il visitatore 1 non vede nulla della copia del visitatore 2
select set_config('request.jwt.claim.sub', 'ee000000-0000-0000-0000-000000000001', false);
set role authenticated;
select test.ok((select count(*) = 0 from bookings where organization_id = :'c2'), 'visitatore 1 non vede i noleggi del visitatore 2');
select test.ok((select count(*) > 0 from bookings where organization_id = :'c1'), 'visitatore 1 vede i propri');
select test.ok((select count(*) = 0 from listings where organization_id = :'c2' and status <> 'published'), 'nessuna bozza altrui visibile');
reset role; reset request.jwt.claim.sub;

-- accettare una richiesta nella copia 1 non tocca la copia 2
select id as req, stripe_payment_intent_id as rpi, total_cents as rtot from bookings
 where organization_id = :'c1' and status = 'requested' limit 1 \gset
set role service_role;
select public.svc_accept_paid_booking(:'req', 'ee000000-0000-0000-0000-000000000001');
select public.svc_confirm_paid_booking(:'req', 'ee000000-0000-0000-0000-000000000001', :'rpi', :rtot);
reset role;
select test.ok((select count(*) = 1 from bookings where organization_id = :'c2' and status = 'requested'), 'la richiesta del visitatore 2 è ancora lì');

-- pulizia dopo 24 ore: copie e utenti di prova via, originale intatto
set role service_role;
select test.ok(private.demo_cleanup(interval '0 seconds') = 2, 'due copie cancellate');
reset role;
select test.ok(not exists (select 1 from organizations where id in (:'c1', :'c2'))
  and not exists (select 1 from auth.users where email like '%@prova.keyrent.it'), 'copie e utenti di prova cancellati');
select test.ok(exists (select 1 from listings where id = :urus and status = 'published'), 'originale intatto');
select test.ok(exists (select 1 from listing_media where listing_id = :urus), 'foto dell''originale intatte');
set role authenticated;
select test.fails('select public.svc_demo_clone(''ee000000-0000-0000-0000-000000000001'')', 'permission denied', 'dal browser non si crea una copia');
reset role;

-- pulizia per i test successivi
select set_config('keyrent.demo_seed', 'on', false);
delete from booking_events where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from reviews where listing_id = :urus;
delete from payments where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from payouts where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from unit_reservations where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%';
select set_config('keyrent.demo_seed', '', false);
update listings set demo_keep = false where id = :urus;
update organizations set is_demo = false where id = :orgB;
