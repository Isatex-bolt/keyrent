-- Flusso prenotazione → pagamento → payout, cancellazioni, pool, scadenze. Gira come "server".
\set ON_ERROR_STOP 1
\set camper '\'3a000000-0000-0000-0000-000000000001\''
\set bici   '\'3a000000-0000-0000-0000-000000000002\''
\set urus   '\'3b000000-0000-0000-0000-000000000001\''
\set ownerA '\'a0000000-0000-0000-0000-000000000001\''
\set ownerB '\'b0000000-0000-0000-0000-000000000001\''
\set cli1   '\'c0000000-0000-0000-0000-000000000001\''
\set cli2   '\'c0000000-0000-0000-0000-000000000002\''

select date_trunc('day', now()) + interval '30 days 10 hours' as p1,
       date_trunc('day', now()) + interval '32 days 10 hours' as r1 \gset

-- ---------- Preventivo ----------
select test.ok((private.quote_listing(:camper, :'p1', :'r1') ->> 'total_cents')::int = 50000, 'camper 2 giorni = €500');
select test.ok((private.quote_listing(:camper, :'p1', (:'p1'::timestamptz + interval '9 days')) ->> 'total_cents')::int = 150000 + 50000,
               'camper 9 giorni = 1 settimana + 2 giorni');
select test.ok((private.quote_listing(:bici, :'p1', (:'p1'::timestamptz + interval '3 hours')) ->> 'total_cents')::int = 2400,
               'bici 3 ore = 3 × €8 (più economico della mezza giornata)');
select test.ok((private.quote_listing(:bici, :'p1', (:'p1'::timestamptz + interval '4 hours')) ->> 'total_cents')::int = 2500,
               'bici 4 ore = mezza giornata €25');

-- ---------- Richiesta + hold ----------
select private.create_booking_request(:cli1, :camper, :'p1', :'r1') as b1 \gset
select test.ok((select status = 'requested' and total_cents = 50000 and commission_cents = 2500 and provider_net_cents = 47500
                from bookings where id = :'b1'), 'richiesta: €500, commissione €25, netto €475');
select test.ok((select count(*) = 1 from unit_reservations where booking_id = :'b1' and kind = 'hold' and active), 'hold creato');
select test.fails(format($$select private.create_booking_request(%L, %L, %L, %L)$$,
                         'c0000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000001',
                         (:'p1'::timestamptz + interval '1 day'), (:'r1'::timestamptz + interval '1 day')),
                  'NOT_AVAILABLE', 'date sovrapposte: seconda richiesta rifiutata');
select test.fails(format($$select private.create_booking_request(%L, %L, %L, %L)$$,
                         'c0000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000001',
                         :'r1', (:'r1'::timestamptz + interval '1 day')),
                  'NOT_AVAILABLE', 'il buffer di pulizia (2 h) blocca il ritiro subito dopo la riconsegna');
select test.fails(format($$select private.create_booking_request(%L, %L, %L, %L)$$,
                         'a0000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001',
                         (:'p1'::timestamptz + interval '20 days'), (:'r1'::timestamptz + interval '20 days')),
                  'SELF_BOOKING', 'il provider non prenota il proprio mezzo');

-- ---------- Dati riservati prima della conferma ----------
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select test.ok(public.get_booking_provider_identity(:'b1') is null, 'prima dell''accettazione: identità del provider nascosta');
select test.ok(public.get_booking_pickup_details(:'b1') is null, 'prima della conferma: indirizzo e telefono nascosti');
select test.ok((select count(*) from bookings) = 1, 'il cliente vede la propria prenotazione');
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.ok((select count(*) from bookings) = 0, 'provider B non vede prenotazioni di A');
reset role; reset request.jwt.claim.sub;

-- ---------- Risposta provider ----------
select test.fails(format($$select private.accept_booking(%L, %L)$$, :'b1', 'b0000000-0000-0000-0000-000000000001'),
                  'FORBIDDEN', 'provider B non può accettare richieste di A');
select private.accept_booking(:'b1', :ownerA);
select test.ok((select status = 'accepted' and customer_confirm_due_at is not null from bookings where id = :'b1'), 'accettata');

set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select test.ok(public.get_booking_provider_identity(:'b1') ->> 'legal_name' = 'Frattin Auto S.r.l.',
               'dopo l''accettazione: il cliente vede ragione sociale e P.IVA');
select test.ok(public.get_booking_pickup_details(:'b1') is null, 'ancora nessun indirizzo prima del pagamento');
reset role; reset request.jwt.claim.sub;

-- ---------- Pagamento ----------
select private.record_authorization(:'b1', 'pi_test_1', 50000);
select private.record_authorization(:'b1', 'pi_test_1', 50000);  -- webhook duplicato: nessun effetto
select test.ok((select count(*) = 1 from payments where booking_id = :'b1'), 'autorizzazione registrata una sola volta');
select test.fails(format($$select private.confirm_booking(%L, %L, 'pi_test_1', 49999)$$, :'b1', 'c0000000-0000-0000-0000-000000000001'),
                  'AMOUNT_MISMATCH', 'importo diverso da quello calcolato: rifiutato');
select private.confirm_booking(:'b1', :cli1, 'pi_test_1', 50000);
select private.confirm_booking(:'b1', :cli1, 'pi_test_1', 50000);  -- idempotente
select test.ok((select status = 'confirmed' from bookings where id = :'b1'), 'confermata');
select test.ok((select kind = 'booking' and expires_at is null from unit_reservations where booking_id = :'b1' and active),
               'hold convertito in prenotazione');
select test.ok((select status = 'pending_pickup' and amount_cents = 47500 from payouts where booking_id = :'b1'),
               'payout €475 in attesa del ritiro');
select test.ok((select sum(amount_cents) = 0 and count(*) = 3 from ledger_entries where booking_id = :'b1'), 'ledger bilanciato');
select test.ok((select -amount_cents = 2500 from ledger_entries where booking_id = :'b1' and account = 'platform_revenue'),
               'commissione KeyRent registrata €25');

set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select test.ok(public.get_booking_pickup_details(:'b1') ->> 'address' = 'Via Venezia 123', 'dopo il pagamento: indirizzo sbloccato');
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
select test.ok(public.get_booking_pickup_details(:'b1') is null, 'un altro cliente non vede i dati di ritiro');
reset role; reset request.jwt.claim.sub;

-- La chat dopo la conferma non filtra più i contatti
insert into conversations (listing_id, customer_id, organization_id, booking_id)
values (:camper, :cli1, '0a000000-0000-0000-0000-000000000001', :'b1') returning id as conv \gset
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select public.send_message(:'conv', 'Il mio numero è 333 123 4567');
select test.ok((select filter_result from messages where conversation_id = :'conv' order by created_at desc limit 1) = 'unfiltered',
               'dopo la conferma i contatti sono consentiti');
select test.ok((select count(*) > 0 from notifications), 'il cliente riceve notifiche in-app');
reset role; reset request.jwt.claim.sub;
select test.ok((select count(*) > 0 from email_deliveries where status = 'pending'),
               'le email restano in coda "pending" finché il provider email non le invia');

-- ---------- Cancellazione con policy versionata ----------
select date_trunc('day', now()) + interval '60 days 10 hours' as p2,
       date_trunc('day', now()) + interval '62 days 10 hours' as r2 \gset
select private.create_booking_request(:cli2, :camper, :'p2', :'r2') as b2 \gset
select private.accept_booking(:'b2', :ownerA);
select private.record_authorization(:'b2', 'pi_test_2', 50000);
select private.confirm_booking(:'b2', :cli2, 'pi_test_2', 50000);
-- una nuova versione di policy non tocca le prenotazioni esistenti
insert into cancellation_policy_versions (policy_id, version, rules)
select id, 2, '{"tiers":[{"min_hours_before":0,"fee_pct":100}]}' from cancellation_policies where code = 'standard';
select test.fails($$update cancellation_policy_versions set rules = '{}' where version = 1$$, 'IMMUTABLE',
                  'le versioni di policy sono immutabili');
select test.ok(private.cancel_booking(:'b2', :cli2, 'customer', 'cambio programma') = 45000,
               'cancellazione a 60 giorni: penale 10% con la policy v1 accettata, rimborso €450');
select test.ok((select amount_cents = 4750 and status = 'scheduled' from payouts where booking_id = :'b2'),
               'al provider va la sua quota della penale (€47,50)');
select test.ok((select sum(amount_cents) = 0 from ledger_entries where booking_id = :'b2'), 'ledger bilanciato dopo il rimborso');
select test.ok((select count(*) = 0 from unit_reservations where booking_id = :'b2' and active), 'date liberate');
select private.mark_refund_succeeded((select id from refunds where booking_id = :'b2'), 're_test_2');
select test.ok((select status = 'partially_refunded' and refunded_cents = 45000 from payments where booking_id = :'b2'),
               'pagamento parzialmente rimborsato');

-- Cancellazione del provider: rimborso 100%
select private.create_booking_request(:cli2, :camper, :'p2', :'r2') as b3 \gset
select private.accept_booking(:'b3', :ownerA);
select private.record_authorization(:'b3', 'pi_test_3', 50000);
select private.confirm_booking(:'b3', :cli2, 'pi_test_3', 50000);
select test.ok(private.cancel_booking(:'b3', :ownerA, 'provider', 'mezzo guasto') = 50000, 'cancella il provider: rimborso 100%');
select test.ok((select status = 'reversed' and amount_cents = 0 from payouts where booking_id = :'b3'), 'payout annullato');

-- ---------- Ritiro e payout a +24 h ----------
select date_trunc('minute', now()) + interval '2 hours' as p4, date_trunc('minute', now()) + interval '2 days' as r4 \gset
select private.create_booking_request(:cli1, :urus, :'p4', :'r4') as b4 \gset
select private.accept_booking(:'b4', :ownerB);
select private.record_authorization(:'b4', 'pi_test_4', (select total_cents from bookings where id = :'b4'));
select private.confirm_booking(:'b4', :cli1, 'pi_test_4', (select total_cents from bookings where id = :'b4'));
select private.mark_picked_up(:'b4', :ownerB);
select test.ok((select status = 'scheduled' and scheduled_for >= now() + interval '23 hours' from payouts where booking_id = :'b4'),
               'dopo il ritiro il payout è programmato a +24 h');
select test.ok((select count(*) = 0 from private.claim_due_payouts()), 'nessun payout prima delle 24 h');
update payouts set scheduled_for = now() - interval '1 minute' where booking_id = :'b4';   -- "viaggio nel tempo"
select test.ok((select count(*) = 1 from private.claim_due_payouts()), 'payout dovuto preso in carico dal worker');
select test.ok((select count(*) = 0 from private.claim_due_payouts()), 'lo stesso payout non viene preso due volte');
select private.mark_payout_paid((select id from payouts where booking_id = :'b4'), 'tr_test_4');
select private.mark_payout_paid((select id from payouts where booking_id = :'b4'), 'tr_test_4');  -- idempotente
select test.ok((select sum(amount_cents) = 0 from ledger_entries
                where booking_id = :'b4' and account = 'provider_payable'), 'debito verso il provider azzerato dopo il payout');
select test.ok((select count(*) = 1 from notifications n join organization_members m on m.user_id = n.user_id
                where n.type = 'payout_paid' and m.organization_id = '0b000000-0000-0000-0000-000000000001'),
               'notifica payout al provider');

-- ---------- Disputa: payout congelato ----------
select private.mark_payment_disputed('pi_test_1');
select test.ok((select status = 'on_hold' from payouts where booking_id = :'b1'), 'disputa: payout in attesa');

-- ---------- Pool: 3 bici identiche ----------
select date_trunc('day', now()) + interval '40 days 9 hours' as pb, date_trunc('day', now()) + interval '40 days 13 hours' as rb \gset
select test.ok((select available_units = 3 from search_listings(p_category => 'bici', p_pickup => :'pb', p_return => :'rb')),
               'ricerca: 3 bici libere');
select private.create_booking_request(('e0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, :bici, :'pb', :'rb')
from generate_series(1, 2) g;
select test.ok((select available_units = 1 from search_listings(p_category => 'bici', p_pickup => :'pb', p_return => :'rb')),
               'ricerca: dopo 2 richieste resta 1 bici');
select private.create_booking_request('e0000000-0000-0000-0000-000000000003', :bici, :'pb', :'rb');
select test.ok((select count(*) = 0 from search_listings(p_category => 'bici', p_pickup => :'pb', p_return => :'rb')),
               'ricerca: con tutte le bici fuori l''annuncio sparisce per quelle date');
select test.ok((select count(*) = 1 from search_listings(p_category => 'bici',
                  p_pickup => (:'pb'::timestamptz + interval '1 day'), p_return => (:'rb'::timestamptz + interval '1 day'))),
               'il giorno dopo le bici sono di nuovo disponibili');
select test.fails(format($$select private.create_booking_request(%L, %L, %L, %L)$$,
                         'e0000000-0000-0000-0000-000000000004', '3a000000-0000-0000-0000-000000000002', :'pb', :'rb'),
                  'NOT_AVAILABLE', 'quarta bici: non disponibile');
update vehicle_units set operational_status = 'maintenance' where id = '2a000000-0000-0000-0000-000000000013';
select test.ok((select available_units = 2 from search_listings(p_category => 'bici',
                  p_pickup => (:'pb'::timestamptz + interval '1 day'), p_return => (:'rb'::timestamptz + interval '1 day'))),
               'una bici in manutenzione riduce la disponibilità di uno');
update vehicle_units set operational_status = 'active' where id = '2a000000-0000-0000-0000-000000000013';

-- ---------- Scadenze ----------
update bookings set provider_response_due_at = now() - interval '1 minute'
 where listing_id = :bici and customer_id = 'e0000000-0000-0000-0000-000000000001';
update unit_reservations set expires_at = now() - interval '1 minute'
 where booking_id = (select id from bookings where listing_id = :bici and customer_id = 'e0000000-0000-0000-0000-000000000001');
select test.ok((select count(*) = 1 from private.expire_stale_bookings()), 'richiesta senza risposta: scaduta');
select test.ok((select available_units = 1 from search_listings(p_category => 'bici', p_pickup => :'pb', p_return => :'rb')),
               'la bici della richiesta scaduta torna disponibile');

-- ---------- Ricerca ----------
select test.ok((select count(*) = 3 from search_listings()), 'ricerca senza filtri: 3 annunci');
select test.ok((select count(*) = 1 from search_listings(p_category => 'auto', p_make => 'lamborghini', p_model => 'urus')),
               'Auto + Lamborghini + Urus');
select test.ok((select count(*) = 0 from search_listings(p_category => 'auto', p_make => 'fiat')), 'Auto + Fiat: nessun risultato');
select test.ok((select count(*) = 2 from search_listings(p_lat => 45.4064, p_lng => 11.8768, p_radius_km => 20)),
               'entro 20 km da Padova: i 2 annunci di Padova');
select test.ok((select count(*) = 1 from search_listings(p_category => 'camper', p_filters => '{"berths":6}')),
               'filtro attributo: camper 6 posti letto');

-- ---------- Webhook e ledger ----------
select test.ok(private.register_stripe_event('evt_1', 'payment_intent.succeeded', '{}'), 'evento Stripe nuovo');
select test.ok(not private.register_stripe_event('evt_1', 'payment_intent.succeeded', '{}'), 'evento Stripe duplicato ignorato');
select test.fails($$insert into ledger_entries (entry_group, account, amount_cents, description)
                    values (gen_random_uuid(), 'stripe_balance', 100, 'x'); set constraints all immediate;$$,
                  'LEDGER_UNBALANCED', 'una registrazione contabile sbilanciata viene rifiutata');

-- ---------- Workflow annunci ----------
select test.fails(format($$select private.listing_transition(%L, 'published', %L)$$, :urus, 'a0000000-0000-0000-0000-000000000001'),
                  'FORBIDDEN_TRANSITION', 'un provider non può agire sugli annunci di un altro');
select test.fails(format($$select private.listing_transition(%L, 'suspended', %L)$$, :urus, 'd0000000-0000-0000-0000-000000000001'),
                  'REASON_REQUIRED', 'sospensione senza motivo: rifiutata');
select private.propose_listing_changes(:camper, :ownerA, '{"title":"Laika Kosmo 6 posti, 2024","status":"published"}') as rev \gset
select test.ok((select status = 'published' and title = 'Laika Kosmo 6 posti' from listings where id = :camper),
               'modifica proposta: online resta la versione approvata');
select test.ok((select not (snapshot -> 'changes' ? 'status') from listing_revisions where id = :'rev'),
               'nella revisione passano solo i campi ammessi');
select private.review_listing_changes(:'rev', 'd0000000-0000-0000-0000-000000000001', true);
select test.ok((select title = 'Laika Kosmo 6 posti, 2024' and published_revision_id = :'rev' from listings where id = :camper),
               'revisione approvata: modifica online');
select test.ok((select count(*) >= 4 from audit_log where entity = 'listing' and entity_id = :camper), 'audit delle transizioni');
