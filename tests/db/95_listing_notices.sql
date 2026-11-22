\set ON_ERROR_STOP 1
select test.ok((select count(*) >= 1 from listing_notices where kind = 'approved'), 'approvazione dello staff: nasce l''avviso per il noleggiatore');
select test.ok((select count(*) >= 1 from notifications where type = 'listing_approved'), 'e la notifica (per email quando ci sarà il provider)');
select organization_id as org from listing_notices where kind = 'approved' limit 1 \gset
select user_id as member from organization_members where organization_id = :'org' and status = 'active' limit 1 \gset
select user_id as other from organization_members where organization_id <> :'org' and status = 'active' limit 1 \gset
set role authenticated;
select set_config('request.jwt.claim.sub', :'other', false);
select test.ok((select count(*) = 0 from listing_notices where organization_id = :'org'), 'un altro noleggiatore non vede gli avvisi');
select public.mark_listing_notices_seen();
select set_config('request.jwt.claim.sub', :'member', false);
select test.ok((select count(*) >= 1 from listing_notices where seen_at is null), 'gli avvisi restano non letti se li apre un altro');
select test.fails($$update listing_notices set seen_at = now()$$, 'permission denied', 'nessuna scrittura diretta');
select public.mark_listing_notices_seen();
select test.ok((select count(*) = 0 from listing_notices where seen_at is null), 'segnati come letti dal noleggiatore');
reset role; reset request.jwt.claim.sub;
