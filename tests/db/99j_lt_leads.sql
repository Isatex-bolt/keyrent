-- Lungo termine a contatto
\set bike '''3a000000-0000-0000-0000-000000000002'''
\set c1 '''c0000000-0000-0000-0000-000000000001'''
\set c2 '''c0000000-0000-0000-0000-000000000002'''
\set owner '''a0000000-0000-0000-0000-000000000001'''
\set ownerB '''b0000000-0000-0000-0000-000000000001'''
update rental_terms set long_term_enabled = true, lt_km_per_year = 10000,
  lt_prices = '{"36": {"10000": 40000, "20000": 46000}}',
  lt_services = '{"assicurazione": {"offered": true, "cents": 3000}, "gomme": {"offered": false, "cents": 900}}' where listing_id = :bike;

select test.ok(private.lt_monthly_cents(:bike, 36, 20000, array['assicurazione', 'gomme']) = 49000, 'rata calcolata dal server (servizi non offerti ignorati)');
select test.fails($$ select private.lt_monthly_cents('3a000000-0000-0000-0000-000000000002', 48, 10000, '{}') $$, 'LT_NOT_OFFERED', 'durata non offerta');

select public.svc_create_lt_request(:c1, :bike, 36, 20000, array['assicurazione'], 'Giulia Bianchi', 'G@x.it', '333 1234567', 'privato', null, null, 'Ciao') as r1 \gset
select test.ok((select fee_cents from lt_requests where id = :'r1') = 2450, 'commissione = 5% della prima rata');
select test.ok((select count(*) from notifications where type = 'lt_request') > 0, 'il noleggiatore riceve la notifica');
select test.fails($$ select public.svc_create_lt_request('c0000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000002', 48, 10000, '{}', 'G', 'g@x.it', '3', 'privato', null, null, null) $$, 'LT_NOT_OFFERED', 'combinazione non offerta rifiutata');
select public.svc_create_lt_request(:c1, :bike, 36, 10000, '{}', 'Giulia Bianchi', 'g@x.it', '333', 'privato', null, null, null) as r1b \gset
select test.ok(:'r1' = :'r1b' and (select count(*) from lt_requests where customer_id = :c1) = 1, 'stesso cliente e mezzo entro 30 giorni: un solo contatto');
select test.fails($$ select public.svc_create_lt_request('c0000000-0000-0000-0000-000000000002', '3a000000-0000-0000-0000-000000000002', 36, 10000, '{}', 'Mario', 'm@x.it', '3', 'azienda', '', '', null) $$, 'LT_COMPANY_MISSING', 'azienda senza ragione sociale');

-- chi vede cosa
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
set role authenticated;
select test.ok((select count(*) from lt_requests) = 0, 'un altro cliente non vede la richiesta');
reset role;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
set role authenticated;
select test.ok((select count(*) from lt_requests) = 0, 'un altro noleggiatore non la vede');
select test.fails($$ insert into lt_requests (listing_id, organization_id, customer_name, customer_email, customer_phone, customer_kind, months, km_per_year, monthly_cents, fee_cents) values ('3a000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'privato', 36, 10000, 1, 0) $$, '42501|permission', 'nessuno scrive dal client');
reset role;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
set role authenticated;
select test.ok((select count(*) from lt_requests) = 1, 'il noleggiatore la vede con i contatti');
reset role; reset request.jwt.claim.sub;

select test.fails($$ select public.svc_lt_set_status('b0000000-0000-0000-0000-000000000001', (select id from lt_requests limit 1), 'contacted') $$, 'NOT_MEMBER|FORBIDDEN|P0001', 'altro noleggiatore non cambia lo stato');
select public.svc_lt_set_status(:owner, :'r1', 'reported', 'Numero inesistente');
select test.ok((select status from lt_requests where id = :'r1') = 'reported', 'segnalazione registrata');
select public.svc_lt_resolve(:'r1', true);
select test.ok((select status from lt_requests where id = :'r1') = 'invalid', 'lo staff la annulla: non si paga');
delete from lt_requests;
update rental_terms set long_term_enabled = false, lt_prices = '{}', lt_km_per_year = null, lt_services = '{}' where listing_id = :bike;
