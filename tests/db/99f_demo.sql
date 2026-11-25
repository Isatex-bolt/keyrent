-- 0025: account dimostrativo · prenotazioni bloccate, esempi protetti, approvazione automatica, ripristino
\set ON_ERROR_STOP 1
\set urus '\'3b000000-0000-0000-0000-000000000001\''
\set owner '\'b0000000-0000-0000-0000-000000000001\''
\set orgA '\'0b000000-0000-0000-0000-000000000001\''
update organizations set is_demo = true where id = :orgA;
update listings set demo_keep = true where id = :urus;
insert into auth.users (id, email) values ('dd900000-0000-0000-0000-0000000000f1', 'prova.uno@demo.keyrent.it') on conflict do nothing;

set role service_role;
select test.fails(format('select public.svc_create_paid_booking_request(%L, %L, %L, %L, %L)', 'c0000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001', (now() + interval '40 days')::text, (now() + interval '42 days')::text, '{}'),
  'DEMO_LISTING', 'annuncio dimostrativo: nessuna prenotazione vera');
reset role;

select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', false);
set role authenticated;
select test.fails(format('update listings set title = %L where id = %L', 'hack', '3b000000-0000-0000-0000-000000000001'),
  'DEMO_PROTECTED', 'annuncio di esempio: non modificabile dal browser');
select test.fails(format('delete from listing_media where listing_id = %L', '3b000000-0000-0000-0000-000000000001'),
  'DEMO_PROTECTED', 'foto degli esempi: non cancellabili');
reset role; reset request.jwt.claim.sub;

-- annuncio nuovo creato provando la demo: approvato da solo dopo 30 secondi
-- bozza = copia completa dell'Urus (foto, prezzi, condizioni, unità)
select gen_random_uuid() as draft \gset
insert into listings (id, organization_id, location_id, category_id, make_id, model_id, title, slug, description, attributes, quantity_mode, status)
select :'draft', organization_id, location_id, category_id, make_id, model_id, 'Prova demo', 'prova-demo', description, attributes, quantity_mode, 'draft'
  from listings where id = :urus;
insert into pricing_rules (listing_id, unit, price_cents) select :'draft', unit, price_cents from pricing_rules where listing_id = :urus;
insert into rental_terms (listing_id, deposit_cents, min_duration_minutes) select :'draft', deposit_cents, min_duration_minutes from rental_terms where listing_id = :urus;
insert into listing_media (listing_id, storage_path, sort, moderation_status) select :'draft', storage_path || '-copia', sort, 'approved' from listing_media where listing_id = :urus;
insert into vehicle_units (id, organization_id, location_id, category_id, label) select gen_random_uuid(), organization_id, location_id, category_id, 'demo' from listings where id = :urus returning id as vu \gset
insert into listing_units (listing_id, vehicle_unit_id) values (:'draft', :'vu');
set role service_role;
select public.svc_listing_transition(:'draft', 'pending_review', :owner);
select test.ok(public.svc_demo_autoapprove() = 0, 'prima dei 30 secondi resta in verifica');
reset role;
update listing_revisions set submitted_at = now() - interval '31 seconds' where listing_id = :'draft' and status = 'pending_review';
set role service_role;
select test.ok(public.svc_demo_autoapprove() = 1, 'dopo 30 secondi: approvato');
reset role;
select test.ok((select status = 'published' from listings where id = :'draft'), 'pubblicato in automatico');
select test.ok(public.listing_is_demo(:urus) and not public.listing_is_demo('3a000000-0000-0000-0000-000000000002'), 'la scheda sa se è dimostrativo');

-- ripristino notturno: dopo 24 ore l'annuncio di prova se ne va, gli esempi restano, noleggi finti rigenerati
update listings set created_at = now() - interval '25 hours' where id = :'draft';
set role service_role;
select public.svc_demo_reset() as res \gset
reset role;
select test.ok(not exists (select 1 from listings where id = :'draft'), 'annuncio di prova cancellato dopo 24 ore');
select test.ok(exists (select 1 from listings where id = :urus and status = 'published'), 'gli esempi restano online');
select test.ok((select count(*) >= 3 from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%'), 'noleggi finti creati sugli esempi');
select test.ok((select count(*) = 1 from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%'
  and status in ('picked_up', 'confirmed', 'requested')), 'un noleggio "di oggi" per mezzo');
select test.ok((select bool_and(total_cents = commission_cents + provider_net_cents) from bookings where organization_id = :orgA and stripe_payment_intent_id like 'pi_demo_%'), 'importi coerenti');
set role service_role;
select public.svc_demo_reset();
reset role;
select test.ok((select count(*) from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%') between 3 and 4, 'rieseguibile: nessun doppione');
-- il concessionario accetta una richiesta finta: si conferma senza Stripe (pagamento pi_demo_)
select id as req, stripe_payment_intent_id as rpi, total_cents as rtot from bookings
 where organization_id = :orgA and status = 'requested' and stripe_payment_intent_id like 'pi_demo_%' limit 1 \gset
set role service_role;
select test.ok(public.svc_accept_paid_booking(:'req', :owner) = :'rpi', 'richiesta finta: accettazione restituisce il pagamento finto');
select public.svc_confirm_paid_booking(:'req', :owner, :'rpi', :rtot);
reset role;
select test.ok((select status = 'confirmed' from bookings where id = :'req'), 'richiesta finta accettata e confermata');
set role service_role;
select test.ok((public.svc_demo_reset() ->> 'noleggi_creati')::int > 0, 'ripristino anche dopo un''accettazione (storico dei noleggi finti rimosso)');
reset role;
select test.fails('delete from booking_events', 'IMMUTABLE', 'lo storico vero resta immutabile');
set role authenticated;
select test.fails('select public.svc_demo_reset()', 'permission denied', 'dal browser non si ripristina');
reset role;

-- pulizia: l'organizzazione di test torna normale per i test successivi
select set_config('keyrent.demo_seed', 'on', false);
delete from booking_events where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from ledger_entries where booking_id in (select id from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%');
delete from reviews where listing_id = :urus; delete from payments where booking_id in (select id from bookings where listing_id = :urus);
delete from payouts where booking_id in (select id from bookings where listing_id = :urus);
delete from unit_reservations where booking_id in (select id from bookings where listing_id = :urus);
delete from bookings where listing_id = :urus and stripe_payment_intent_id like 'pi_demo_%';
select set_config('keyrent.demo_seed', '', false);
update listings set demo_keep = false where id = :urus;
update organizations set is_demo = false where id = :orgA;
