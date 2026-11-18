-- Isolamento tra provider e permessi: eseguiti con i ruoli reali (anon / authenticated).
\set ON_ERROR_STOP 1

-- ===== Provider A (owner Frattin) =====
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select test.ok((select count(*) from listings) = 2, 'provider A vede solo i propri 2 annunci');
select test.ok((select count(*) from listings where organization_id = '0b000000-0000-0000-0000-000000000001') = 0,
               'provider A non vede annunci del provider B');
select test.ok((select count(*) from locations) = 1, 'provider A vede solo la propria sede');
select test.ok((select count(*) from organizations) = 1, 'provider A vede solo la propria organizzazione');

with u as (update vehicle_units set label = 'hack' where organization_id = '0b000000-0000-0000-0000-000000000001' returning 1)
select test.ok((select count(*) from u) = 0, 'provider A non può modificare mezzi di B (0 righe)');

select test.fails($$insert into vehicle_units (organization_id, location_id, category_id)
  values ('0b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001',
          (select id from categories where slug = 'auto'))$$,
  'row-level security', 'provider A non può creare mezzi nell''organizzazione B');

select test.fails($$insert into vehicle_units (organization_id, location_id, category_id)
  values ('0a000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001',
          (select id from categories where slug = 'auto'))$$,
  'foreign key', 'un mezzo di A non può essere messo nella sede di B');

select test.fails($$update listings set status = 'published' where id = '3a000000-0000-0000-0000-000000000001'$$,
  'permission denied', 'il client non può cambiare lo stato di un annuncio');

select test.fails($$update listings set title = 'Nuovo titolo' where id = '3a000000-0000-0000-0000-000000000001'$$,
  'USE_REVISION', 'modifica di un campo sensibile su annuncio pubblicato richiede revisione');

with u as (update pricing_rules set price_cents = 26000
            where listing_id = '3a000000-0000-0000-0000-000000000001' and unit = 'day' returning 1)
select test.ok((select count(*) from u) = 1, 'il prezzo di un annuncio pubblicato si modifica subito');
update pricing_rules set price_cents = 25000 where listing_id = '3a000000-0000-0000-0000-000000000001' and unit = 'day';

select test.fails($$update organizations set verification_status = 'verified' where id = '0a000000-0000-0000-0000-000000000001'$$,
  'permission denied', 'il provider non può auto-verificarsi');
select test.fails($$update organizations set stripe_account_id = 'acct_x' where id = '0a000000-0000-0000-0000-000000000001'$$,
  'permission denied', 'il provider non può cambiare il conto Stripe dal client');

select test.fails($$insert into payments (booking_id, stripe_payment_intent_id, amount_cents, status)
  values (gen_random_uuid(), 'pi_x', 100, 'captured')$$, 'permission denied', 'il client non scrive pagamenti');
select test.fails($$update payouts set status = 'paid'$$, 'permission denied', 'il client non cambia stato ai payout');
select test.fails($$select private.confirm_booking(gen_random_uuid(), gen_random_uuid(), 'pi', 1)$$,
  'permission denied', 'il client non può chiamare le funzioni di dominio');

select test.fails($$insert into unit_reservations (vehicle_unit_id, period, kind)
  values ('2b000000-0000-0000-0000-000000000001', tstzrange(now() + interval '30 days', now() + interval '31 days'), 'block')$$,
  'row-level security', 'provider A non può bloccare date di un mezzo di B');
select test.fails($$insert into unit_reservations (vehicle_unit_id, period, kind, expires_at)
  values ('2a000000-0000-0000-0000-000000000001', tstzrange(now() + interval '30 days', now() + interval '31 days'), 'hold', now() + interval '1 day')$$,
  'row-level security', 'il provider può creare solo blocchi, non hold di prenotazione');

-- Staff del provider A (ruolo staff): legge, non modifica annunci
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select test.ok((select count(*) from listings) = 2, 'lo staff del provider vede gli annunci della sua organizzazione');
with u as (update listings set instant_book = true returning 1)
select test.ok((select count(*) from u) = 0, 'lo staff del provider non può modificare annunci');
select test.ok((select count(*) from payouts) = 0, 'lo staff del provider non vede gli incassi');

-- ===== Provider B =====
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.ok((select count(*) from listings) = 1, 'provider B vede solo il proprio annuncio');
select test.ok((select count(*) from vehicle_units where organization_id = '0a000000-0000-0000-0000-000000000001') = 0,
               'provider B non vede i mezzi di A');

-- ===== Cliente =====
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select test.ok((select count(*) from listings) = 0, 'il cliente non legge la tabella listings grezza');
select test.ok((select count(*) from public_listings) = 3, 'il cliente vede i 3 annunci pubblicati nella vista pubblica');
select test.ok((select count(*) from locations) = 0, 'il cliente non vede indirizzi delle sedi');
select test.ok((select count(*) from organizations) = 0, 'il cliente non vede le anagrafiche dei provider');

with u as (update profiles set first_name = 'X' where id = 'c0000000-0000-0000-0000-000000000002' returning 1)
select test.ok((select count(*) from u) = 0, 'un cliente non modifica il profilo di un altro');
with u as (update profiles set first_name = 'Mario' where id = 'c0000000-0000-0000-0000-000000000001' returning 1)
select test.ok((select count(*) from u) = 1, 'il cliente modifica il proprio profilo');
select test.fails($$update profiles set is_blocked = false where id = auth.uid()$$, 'permission denied',
  'il cliente non può sbloccarsi da solo');

-- Messaggistica: contatti filtrati lato server prima della prenotazione
select public.start_conversation('3a000000-0000-0000-0000-000000000001', 'Il camper dispone di 4 posti letto?');
select test.ok((select filter_result from messages order by created_at desc limit 1) = 'clean', 'domanda normale: consentita');
select public.send_message((select id from conversations limit 1), 'Chiamami al 333 123 4567 grazie');
select test.ok((select body_shown from messages order by created_at desc limit 1) = 'Chiamami al [contatto rimosso] grazie',
               'telefono rimosso dal messaggio');
select public.send_message((select id from conversations limit 1), 'mario.rossi@gmail.com');
select test.ok((select filter_result from messages order by created_at desc limit 1) = 'blocked', 'messaggio con solo email: bloccato');
select public.send_message((select id from conversations limit 1), 'Scrivimi su whatsapp o vai su www.miosito.it');
select test.ok((select filter_result from messages order by created_at desc limit 1) = 'redacted', 'whatsapp e URL rimossi');
select public.send_message((select id from conversations limit 1), 'Arrivo il 10/12 alle 10:30, quanto costa per 3 giorni? 750 euro?');
select test.ok((select filter_result from messages order by created_at desc limit 1) = 'clean', 'date, orari e prezzi non sono falsi positivi');
select test.fails($$select body_original from messages$$, 'permission denied', 'i partecipanti non leggono il testo originale');

-- Il provider B non vede la conversazione tra cliente e A
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.ok((select count(*) from conversations) = 0, 'provider B non vede conversazioni di A');
select test.fails($$select public.send_message((select id from conversations limit 1), 'ciao')$$, 'NOT_FOUND|FORBIDDEN',
  'provider B non può scrivere in conversazioni altrui');

-- ===== Anonimo =====
reset request.jwt.claim.sub;
set role anon;
select test.ok((select count(*) from public_listings) = 3, 'anonimo: vede gli annunci pubblicati');
select test.ok((select count(*) from public_listings where city = 'Padova') = 2, 'anonimo: vede la città');
select test.fails($$select * from listings$$, 'permission denied', 'anonimo: niente accesso alla tabella listings');
select test.fails($$select * from locations$$, 'permission denied', 'anonimo: niente accesso agli indirizzi');
select test.fails($$select * from organizations$$, 'permission denied', 'anonimo: niente accesso alle anagrafiche');
select test.fails($$select public.start_conversation('3a000000-0000-0000-0000-000000000001', 'ciao')$$,
  'permission denied', 'anonimo: non può scrivere messaggi');
select test.ok(not exists (select 1 from information_schema.columns
                            where table_name = 'public_listings'
                              and column_name in ('organization_id', 'address_line', 'phone', 'legal_name', 'vat_number')),
               'la vista pubblica non espone campi del provider');
reset role;
