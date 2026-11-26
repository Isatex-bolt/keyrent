-- Monitoraggio link demo
select public.svc_demo_visit('autonoleggio-rossi');
select public.svc_demo_visit('autonoleggio-rossi');
select public.svc_demo_entered('autonoleggio-rossi', null);
select test.ok((select visits = 2 and entered = 1 from demo_visits where ref = 'autonoleggio-rossi'), 'visite e ingressi contati per link');
select test.fails($$ select public.svc_demo_visit('Nome Strano!') $$, 'demo_visits_ref_check', 'nome del link solo lettere, numeri e trattini');
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
set role authenticated;
select test.ok((select count(*) from demo_visits) = 0, 'i non staff non vedono il monitoraggio');
reset role; reset request.jwt.claim.sub;
delete from demo_visits;
