-- Contatori delle novità (0009)
\set ON_ERROR_STOP 1
select date_trunc('day', now()) + interval '150 days 10 hours' as p, date_trunc('day', now()) + interval '152 days 10 hours' as r \gset
set role service_role;
select public.svc_create_booking_request('c0000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000001', :'p', :'r') as bk \gset
reset role;

set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select (public.my_badges() ->> 'requests')::int as req_before \gset
select test.ok(:req_before >= 1, 'il noleggiatore B vede la richiesta nel contatore Richieste');
reset role;
select count(*) as a_req from bookings where organization_id = '0a000000-0000-0000-0000-000000000001'
  and status = 'requested' and provider_response_due_at > now() \gset
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.ok((public.my_badges() ->> 'requests')::int = :a_req, 'il contatore di A conta solo le richieste di A');
select test.ok(not exists (select 1 from bookings where id = :'bk'), 'A non vede la richiesta fatta a B');

-- messaggi: il cliente scrive, il noleggiatore vede 1 non letto, poi lo legge
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select public.start_conversation('3b000000-0000-0000-0000-000000000001', 'Domanda per il contatore') as conv \gset
select test.ok((public.my_badges() ->> 'messages')::int = 0, 'i miei messaggi non contano come non letti');
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select (public.my_badges() ->> 'messages')::int as unread \gset
select test.ok(:unread >= 1, 'il noleggiatore ha messaggi non letti');
select public.mark_conversation_read(:'conv');
select test.ok((public.my_badges() ->> 'messages')::int = :unread - 1 or (public.my_badges() ->> 'messages')::int < :unread,
               'aperta la conversazione, il contatore scende');
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select public.mark_conversation_read(:'conv');
select test.ok((select count(*) = 0 from conversation_reads where conversation_id = :'conv' and user_id = 'a0000000-0000-0000-0000-000000000001'),
               'chi non partecipa non può segnare come letta una conversazione altrui');
select test.fails($$insert into conversation_reads (conversation_id, user_id) values (gen_random_uuid(), auth.uid())$$, 'permission denied',
                  'il browser non scrive direttamente le letture');
reset role; reset request.jwt.claim.sub;

-- prenotazioni: il noleggiatore accetta, il cliente vede 1 novità, la apre e scende
set role service_role;
select public.svc_accept_booking(:'bk', 'b0000000-0000-0000-0000-000000000001');
reset role;
set role authenticated;
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select (public.my_badges() ->> 'customer_bookings')::int as cb \gset
select test.ok(:cb >= 1, 'il cliente vede la novità "accettata" nel contatore');
select public.mark_booking_updates_seen(:'bk', 'customer');
select test.ok((public.my_badges() ->> 'customer_bookings')::int = :cb - 1, 'aperta la prenotazione, il contatore scende');
select test.ok((public.my_badges() ->> 'admin_reviews')::int = 0, 'chi non è staff non vede contatori admin');
set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select test.ok(public.my_badges() ? 'admin_orgs', 'lo staff riceve i contatori admin');
reset role; reset request.jwt.claim.sub;
