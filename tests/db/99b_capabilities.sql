\set ON_ERROR_STOP 1
-- Capacità separate: privato, azienda cliente, attività di noleggio (0019)
insert into auth.users (id, email, raw_user_meta_data) values
  ('f0000000-0000-0000-0000-000000000001', 'privato@test.it', '{"customer_kind":"privato","first_name":"Anna"}'),
  ('f0000000-0000-0000-0000-000000000002', 'azienda@test.it', '{"customer_kind":"azienda"}'),
  ('f0000000-0000-0000-0000-000000000003', 'nolo@test.it', '{"pending_org":{"legal_name":"X"}}');
select test.ok((select rents_personally from profiles where id = 'f0000000-0000-0000-0000-000000000001'), 'registrato come privato: profilo privato attivo');
select test.ok((select not rents_personally from profiles where id = 'f0000000-0000-0000-0000-000000000002'), 'registrato come azienda: nessun profilo privato automatico');
select test.ok((select not rents_personally from profiles where id = 'f0000000-0000-0000-0000-000000000003'), 'registrato come noleggiatore: nessun profilo privato automatico');
select test.ok((select not rents_personally from profiles where id = 'a0000000-0000-0000-0000-000000000001'), 'il titolare di un''attività non diventa cliente privato');

select vat_number as pvat from organizations where id = '0a000000-0000-0000-0000-000000000001' \gset
set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', false);
select test.fails($$update profiles set rents_personally = true where id = auth.uid()$$, 'permission denied', 'la capacità non si cambia scrivendo nel profilo');
select test.fails($$select public.enable_personal_renting('Bea', 'Rossi', '')$$, 'EMPTY', 'servono nome, cognome e telefono');
select public.enable_personal_renting('Bea', 'Rossi', '+39 333 1112223');
select test.ok((select rents_personally and phone = '+39 333 1112223' from profiles where id = auth.uid()), 'aggiungi profilo privato: scelta esplicita');
-- la stessa P.IVA dell'attività di noleggio di test può esistere come azienda cliente
select public.create_renter_organization('Frattin cliente', :'pvat') as rorg \gset
reset role;
select test.ok((select count(*) = 2 from organizations where vat_number = :'pvat'), 'stessa P.IVA: attività di noleggio e azienda cliente sono entità diverse');
set role authenticated;
select test.fails(format('select public.create_renter_organization(%L, %L)', 'Doppione', :'pvat'), 'duplicate', 'ma non due aziende clienti con la stessa P.IVA');
reset role; reset request.jwt.claim.sub;

-- un'attività di noleggio non può essere intestataria di una prenotazione
set role service_role;
select test.fails(format('select public.svc_set_booking_billing(gen_random_uuid(), %L, %L)', 'a0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001'),
  'NOT_MEMBER', 'si prenota solo per un''azienda cliente, non per l''attività di noleggio');
reset role;
