\set ON_ERROR_STOP 1
set role authenticated;
-- un noleggiatore scrive al team per la sua attività
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
select public.support_start('Come carico i mezzi?', 'Ciao, mi aiutate?', '0a000000-0000-0000-0000-000000000001') as thread \gset
select test.fails($$select public.support_start('x', 'y', '0b000000-0000-0000-0000-000000000001')$$,
  'NOT_MEMBER', 'non si scrive a nome di un''attività altrui');
select test.fails(format('insert into support_messages (thread_id, sender_id, from_staff, body) values (%L, auth.uid(), true, %L)', :'thread', 'x'),
  'permission denied', 'nessuna scrittura diretta');
select test.ok((select count(*) = 1 from support_threads), 'il noleggiatore vede la sua conversazione');
-- un altro utente non vede nulla e non può rispondere
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false);
select test.ok((select count(*) = 0 from support_threads) and (select count(*) = 0 from support_messages), 'un altro utente non vede la conversazione');
select test.fails(format('select public.support_reply(%L, %L)', :'thread', 'ciao'), 'NOT_ALLOWED', 'un altro utente non può rispondere');
select test.fails(format('select public.support_set_status(%L, %L)', :'thread', 'closed'), 'NOT_ALLOWED', 'solo lo staff chiude');
-- lo staff vede il messaggio non letto e risponde
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', false);
select test.ok((public.my_support_badges() ->> 'admin_support')::int = 1, 'lo staff ha 1 messaggio da leggere');
select public.support_mark_read(:'thread');
select test.ok((public.my_support_badges() ->> 'admin_support')::int = 0, 'letto dallo staff');
select public.support_reply(:'thread', 'Certo, ecco come fare.');
select test.ok((select from_staff from support_messages where thread_id = :'thread' order by created_at desc limit 1), 'la risposta risulta del team');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
select test.ok((public.my_support_badges() ->> 'support')::int = 1, 'il noleggiatore vede la risposta da leggere');
select test.ok((public.my_support_badges() ->> 'admin_support')::int = 0, 'un non staff non ha contatori admin');
select public.support_mark_read(:'thread');
select test.ok((public.my_support_badges() ->> 'support')::int = 0, 'risposta letta');
reset role; reset request.jwt.claim.sub;
select test.ok((select count(*) = 2 from notifications where type = 'support_to_staff'
                  and payload ->> 'thread_id' = :'thread'), 'avvisati admin e assistenza clienti');
select test.ok((select payload ->> 'path' from notifications where type = 'support_reply' limit 1) = '/pro/assistenza/' || :'thread',
  'la risposta porta all''area noleggiatore');
