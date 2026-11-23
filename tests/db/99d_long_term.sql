\set ON_ERROR_STOP 1
-- Lungo termine (0022)
\set camper '3a000000-0000-0000-0000-000000000001'
select test.ok((select short_term_enabled and not long_term_enabled from rental_terms where listing_id = :'camper'), 'di default solo breve termine');
select test.fails(format('update rental_terms set short_term_enabled = false where listing_id = %L', :'camper'),
  'rental_terms_modes_check', 'almeno una modalità: breve o lungo termine');
select test.fails(format($$update rental_terms set long_term_enabled = true, lt_km_per_year = 15000 where listing_id = %L$$, :'camper'),
  'rental_terms_modes_check', 'lungo termine senza rata mensile: rifiutato');
set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
select test.fails(format($$update rental_terms set long_term_enabled = true, lt_km_per_year = 15000, lt_prices = '{"36": 45000}' where listing_id = %L$$, :'camper'),
  'DELIVERY_NEEDS_REVIEW', 'annuncio online: il lungo termine passa dalla revisione');
reset role; reset request.jwt.claim.sub;
select private.propose_listing_changes(:'camper', 'a0000000-0000-0000-0000-000000000001',
  '{"terms":{"short_term_enabled":true,"long_term_enabled":true,"lt_prices":{"24":52000,"36":45000},"lt_km_per_year":15000,"lt_extra_km_cents":12,"lt_services":{"bollo":{"offered":true,"cents":0},"gomme":{"offered":true,"cents":2500}}}}') as lrev \gset
select private.review_listing_changes(:'lrev', 'd0000000-0000-0000-0000-000000000001', true);
set role anon;
select test.ok((select long_term and short_term and lt_from_cents = 45000 and lt_km_per_year = 15000 from public.listing_offers(array[:'camper']::uuid[])),
  'revisione approvata: offerta a lungo termine visibile, "da 450 €/mese"');
reset role;
