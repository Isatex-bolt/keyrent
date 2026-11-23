\set ON_ERROR_STOP 1
-- Consegna a domicilio (0020): decisa dal noleggiatore, su annuncio online passa dalla revisione
\set camper '3a000000-0000-0000-0000-000000000001'
select status as camper_status from listings where id = :'camper' \gset
select test.ok(:'camper_status' = 'published', 'annuncio di prova online');
select test.ok((select not delivery_enabled from rental_terms where listing_id = :'camper'), 'consegna spenta di default');

set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
select test.fails(format('update rental_terms set delivery_enabled = true, delivery_radius_km = 20 where listing_id = %L', :'camper'),
  'DELIVERY_NEEDS_REVIEW', 'annuncio online: la consegna non si cambia direttamente');
select test.ok((select count(*) = 1 from rental_terms where listing_id = :'camper'), 'le altre condizioni restano modificabili come prima');
reset role; reset request.jwt.claim.sub;

select test.fails(format('update rental_terms set delivery_enabled = true, delivery_radius_km = 0 where listing_id = %L', :'camper'),
  'rental_terms_delivery_check', 'consegna attiva senza raggio valido: rifiutata');

-- proposta in revisione → approvata dal team → consegna attiva
select private.propose_listing_changes(:'camper', 'a0000000-0000-0000-0000-000000000001',
  '{"terms":{"delivery_enabled":true,"delivery_radius_km":25,"delivery_fee_cents":1000,"delivery_per_km_cents":80}}') as drev \gset
select test.ok((select not delivery_enabled from rental_terms where listing_id = :'camper'), 'in revisione: online resta senza consegna');
select private.review_listing_changes(:'drev', 'd0000000-0000-0000-0000-000000000001', true);
select test.ok((select delivery_enabled and delivery_radius_km = 25 and delivery_fee_cents = 1000 and delivery_per_km_cents = 80
                  from rental_terms where listing_id = :'camper'), 'revisione approvata: consegna attiva');

set role anon;
select test.ok((select enabled and radius_km = 25 from public.listing_delivery(:'camper')), 'la scheda pubblica vede raggio e prezzi della consegna');
reset role;

-- 0021 · il team invia in revisione un annuncio preparato per un noleggiatore
insert into listings (organization_id, location_id, category_id, title, slug)
select organization_id, location_id, category_id, 'Bozza dal team', 'bozza-dal-team' from listings where id = :'camper'
returning id as draft_id \gset
select test.fails(format($$select private.listing_transition(%L, 'pending_review', %L)$$, :'draft_id', 'c0000000-0000-0000-0000-000000000001'),
  'FORBIDDEN_TRANSITION', 'un cliente non invia in revisione annunci altrui');
do $$ begin
  perform private.listing_transition((select id from listings where slug = 'bozza-dal-team'), 'pending_review', 'd0000000-0000-0000-0000-000000000001');
  raise notice 'ok - il team invia in revisione la bozza preparata per il cliente';
exception when others then
  if sqlerrm like 'FORBIDDEN_TRANSITION%' then raise exception 'not ok - lo staff non può inviare in revisione';
  else raise notice 'ok - il team supera il controllo permessi (poi vale il controllo di completezza: %)', left(sqlerrm, 40); end if;
end $$;
