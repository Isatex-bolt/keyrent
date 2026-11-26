\set ON_ERROR_STOP 1
set role anon;
select test.ok((select count(*) = 10 from public.home_collections), 'anon legge le esigenze della home');
select test.ok((select count(*) = 10 from public.destinations), 'anon legge le destinazioni');
select test.fails($$update public.destinations set name = 'x'$$, 'permission denied', 'anon non modifica le destinazioni');
reset role;
update public.destinations set active = false where slug = 'langhe';
set role anon;
select test.ok((select count(*) = 9 from public.destinations), 'le destinazioni disattivate non si vedono');
reset role;
update public.destinations set active = true where slug = 'langhe';
