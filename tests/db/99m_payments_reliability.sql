-- 0036: addebito con esito incerto, recupero, webhook, rimborsi, accrediti
\set ON_ERROR_STOP 1
select date_trunc('day', now()) + interval '300 days 10 hours' as p, date_trunc('day', now()) + interval '302 days 10 hours' as r \gset
\set urus '\'3b000000-0000-0000-0000-000000000001\''
\set cli '\'c0000000-0000-0000-0000-000000000001\''
\set owner '\'b0000000-0000-0000-0000-000000000001\''
\set orgb '\'0b000000-0000-0000-0000-000000000001\''

set role service_role;
select public.svc_create_paid_booking_request(:cli, :urus, :'p', :'r', '{}') as bk \gset
select public.svc_set_payment_intent(:'bk', :cli, 'pi_rel_1');
select public.svc_payment_authorized(:'bk', 'pi_rel_1', (select total_cents from bookings where id = :'bk'));

-- 1) accettazione: addebito "in corso", ripetibile
select test.ok(public.svc_accept_paid_booking(:'bk', :owner) = 'pi_rel_1', 'accettazione restituisce il pagamento');
select test.ok((select capture_pending_since is not null from bookings where id = :'bk'), 'addebito segnato in corso');
select test.ok(public.svc_accept_paid_booking(:'bk', :owner) = 'pi_rel_1', 'nuovo tentativo della stessa accettazione: nessun errore');
select test.fails(format('select public.svc_accept_paid_booking(%L, %L)', :'bk', 'a0000000-0000-0000-0000-000000000001'),
  'NOT_MEMBER|FORBIDDEN|not a member|permesso|INVALID', 'un altro noleggiatore non può ritentare');

-- 2) le scadenze non toccano un addebito in corso
reset role;
update bookings set customer_confirm_due_at = now() - interval '1 minute' where id = :'bk';
update unit_reservations set expires_at = now() - interval '1 minute' where booking_id = :'bk' and active;
set role service_role;
select count(*) from public.svc_expire_all();
select test.ok((select status = 'accepted' from bookings where id = :'bk')
  and exists (select 1 from unit_reservations where booking_id = :'bk' and active), 'scadenza saltata: addebito in corso, mezzo ancora bloccato');
select test.ok((select count(*) = 1 from public.svc_pending_captures() where booking_id = :'bk'), 'compare tra gli addebiti da verificare');

-- 3) recupero automatico: Stripe dice "riuscito" → conferma di sistema, una volta sola
select public.svc_confirm_paid_booking(:'bk', null, 'pi_rel_1', (select total_cents from bookings where id = :'bk'));
select public.svc_confirm_paid_booking(:'bk', null, 'pi_rel_1', (select total_cents from bookings where id = :'bk'));
reset role;
select test.ok((select status = 'confirmed' and capture_pending_since is null from bookings where id = :'bk')
  and (select status = 'captured' from payments where booking_id = :'bk')
  and (select count(*) = 1 from payouts where booking_id = :'bk')
  and (select count(distinct entry_group) = 1 from ledger_entries where booking_id = :'bk'), 'confermata una sola volta, contabilità coerente');
select test.ok((select coalesce(sum(amount_cents), 0) = 0 from ledger_entries where booking_id = :'bk'), 'partita doppia a zero');
set role service_role;
select test.ok((select count(*) = 0 from public.svc_pending_captures() where booking_id = :'bk'), 'nessun addebito più da verificare');
reset role;

-- 4) carta ancora bloccata su prenotazione scaduta → da sbloccare
set role service_role;
select public.svc_create_paid_booking_request(:cli, :urus, (:'p'::timestamptz + interval '10 days'), (:'r'::timestamptz + interval '10 days'), '{}') as bk2 \gset
select public.svc_set_payment_intent(:'bk2', :cli, 'pi_rel_2');
select public.svc_payment_authorized(:'bk2', 'pi_rel_2', (select total_cents from bookings where id = :'bk2'));
reset role;
update bookings set provider_response_due_at = now() - interval '1 minute' where id = :'bk2';
set role service_role;
select count(*) from public.svc_expire_all();
select test.ok((select status = 'expired' from bookings where id = :'bk2'), 'richiesta senza risposta scaduta senza visite al sito');
select test.ok((select count(*) = 1 from public.svc_holds_to_release() where booking_id = :'bk2'), 'carta da sbloccare individuata');
select public.svc_payment_canceled('pi_rel_2');
select test.ok((select count(*) = 0 from public.svc_holds_to_release() where booking_id = :'bk2'), 'dopo lo sblocco non compare più');

-- 5) webhook: ricevuto ≠ completato
select test.ok(public.svc_stripe_event_claim('evt_rel_1', 'payment_intent.succeeded', '{}') = 'process', 'primo invio: da elaborare');
select test.ok(public.svc_stripe_event_claim('evt_rel_1', 'payment_intent.succeeded', '{}') = 'busy', 'invio simultaneo: in elaborazione altrove');
select public.svc_stripe_event_failed('evt_rel_1', 'errore finto');
select test.ok(public.svc_stripe_event_claim('evt_rel_1', 'payment_intent.succeeded', '{}') = 'process', 'dopo un errore Stripe lo rimanda e si rielabora');
select public.svc_stripe_event_done('evt_rel_1');
select test.ok(public.svc_stripe_event_claim('evt_rel_1', 'payment_intent.succeeded', '{}') = 'done', 'duplicato dopo il completamento: ignorato');
reset role;
select test.ok((select attempts = 2 and processed_at is not null and error is null from stripe_events where event_id = 'evt_rel_1'), 'tentativi registrati');
update stripe_events set processing_started_at = null where event_id = 'evt_rel_1';

-- 6) rimborsi con stato reale
insert into refunds (payment_id, booking_id, amount_cents, reason)
  select id, booking_id, 1000, 'test' from payments where booking_id = :'bk' returning id as rf \gset
insert into refunds (payment_id, booking_id, amount_cents, reason)
  select id, booking_id, 500, 'test' from payments where booking_id = :'bk' returning id as rf2 \gset
set role service_role;
select test.ok((select count(*) = 2 from public.svc_refunds_open() where booking_id = :'bk'), 'rimborsi aperti da creare/verificare');
select public.svc_refund_update(:'rf', 're_rel_1', 'pending');
select test.ok((select status = 'pending' and stripe_refund_id = 're_rel_1' from refunds where id = :'rf')
  and (select refunded_cents = 0 from payments where booking_id = :'bk'), 'rimborso in corso: non ancora contato come rimborsato');
select test.ok(public.svc_refund_by_stripe_id('re_rel_1') = :'rf', 'ritrovato dal suo id Stripe');
select test.fails(format('select public.svc_refund_update(%L, %L, %L)', :'rf', 're_diverso', 'succeeded'), 'REFUND_MISMATCH', 'id Stripe diverso rifiutato');
select public.svc_refund_update(:'rf', 're_rel_1', 'succeeded');
select public.svc_refund_update(:'rf', 're_rel_1', 'succeeded');
select test.ok((select refunded_cents = 1000 and status = 'partially_refunded' from payments where booking_id = :'bk'), 'riuscito contato una volta sola');
select public.svc_refund_update(:'rf2', 're_rel_2', 'failed', 'carta chiusa');
select test.ok((select status = 'failed' and failure_reason = 'carta chiusa' from refunds where id = :'rf2')
  and (select refunded_cents = 1000 from payments where booking_id = :'bk'), 'rimborso fallito registrato, importi invariati');

-- 7) accrediti al noleggiatore
reset role;
update organizations set stripe_account_id = null, stripe_payouts_enabled = false where id = :orgb;
update payouts set status = 'scheduled', scheduled_for = now() - interval '1 minute' where booking_id = :'bk';
set role service_role;
select test.ok((select count(*) = 0 from public.svc_claim_due_payouts() where booking_id = :'bk'), 'senza conto Stripe: nessun trasferimento');
select test.ok((select status = 'on_hold' and failure_reason = 'CONTO_NON_COLLEGATO' from payouts where booking_id = :'bk'), 'accredito sospeso con motivo esplicito');
select public.svc_org_stripe_account(:orgb, 'acct_test_b', true, true);
select test.ok((select status = 'scheduled' from payouts where booking_id = :'bk'), 'conto collegato: accredito di nuovo in coda');
select test.ok((select count(*) = 1 from public.svc_claim_due_payouts() where booking_id = :'bk' and stripe_account_id = 'acct_test_b'), 'preso in carico con il conto giusto');
select test.ok((select count(*) = 0 from public.svc_claim_due_payouts() where booking_id = :'bk'), 'seconda esecuzione: non lo riprende');
reset role;
alter table payouts disable trigger payouts_touch;
update payouts set updated_at = now() - interval '20 minutes' where booking_id = :'bk';
alter table payouts enable trigger payouts_touch;
set role service_role;
select test.ok(public.svc_payouts_unstick() >= 1, 'processo interrotto: rimesso in coda');
select test.ok((select status = 'scheduled' from payouts where booking_id = :'bk'), 'processo interrotto: accredito di nuovo prenotabile');
select count(*) from public.svc_claim_due_payouts();
select (select id from payouts where booking_id = :'bk') as po \gset
select public.svc_payout_paid(:'po', 'tr_rel_1');
select public.svc_payout_paid(:'po', 'tr_rel_1');
reset role;
select test.ok((select status = 'paid' and stripe_transfer_id = 'tr_rel_1' from payouts where id = :'po')
  and (select count(*) = 1 from ledger_entries where booking_id = :'bk' and description = 'Payout al provider'),
  'trasferito una volta sola');
select test.ok((select coalesce(sum(amount_cents), 0) = 0 from ledger_entries where booking_id = :'bk' and account = 'provider_payable'), 'debito verso il noleggiatore chiuso');
update organizations set stripe_account_id = null, stripe_payouts_enabled = false, stripe_details_submitted = false where id = :orgb;

-- 8) il browser non chiama nulla di tutto questo
set role authenticated;
select test.fails($$select public.svc_stripe_event_claim('x', 'y', '{}')$$, 'permission denied', 'browser: niente webhook');
select test.fails($$select * from public.svc_claim_due_payouts()$$, 'permission denied', 'browser: niente accrediti');
select test.fails($$select public.svc_refund_update(gen_random_uuid(), 'x', 'succeeded')$$, 'permission denied', 'browser: niente rimborsi');
reset role;
