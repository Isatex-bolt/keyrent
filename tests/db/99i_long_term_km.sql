-- Lungo termine con rata per km annui
\set bike '''3a000000-0000-0000-0000-000000000002'''
update rental_terms set long_term_enabled = true, lt_km_per_year = 10000,
  lt_prices = '{"36": {"10000": 39900, "20000": 45900}, "48": {"10000": 35900}}' where listing_id = :bike;
select test.ok((select lt_from_cents from public.listing_offers(array[:bike::uuid])) = 35900, 'lungo termine a km: rata minima');
update rental_terms set lt_prices = '{"36": 41900}' where listing_id = :bike;
select test.ok((select lt_from_cents from public.listing_offers(array[:bike::uuid])) = 41900, 'vecchio formato ancora valido');
select test.fails($$ update rental_terms set lt_prices = '{"36": {"10000": 0}}' where listing_id = '3a000000-0000-0000-0000-000000000002' $$,
  'rental_terms_modes_check', 'serve almeno una rata');
update rental_terms set long_term_enabled = false, lt_prices = '{}', lt_km_per_year = null where listing_id = :bike;
