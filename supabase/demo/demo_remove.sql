-- Rimuove tutti i dati dimostrativi (organizzazione DEMO e tutto ciò che contiene)
delete from pricing_rules  where listing_id in (select id from listings where organization_id = 'de000000-0000-0000-0000-000000000001');
delete from rental_terms   where listing_id in (select id from listings where organization_id = 'de000000-0000-0000-0000-000000000001');
delete from listing_units  where listing_id in (select id from listings where organization_id = 'de000000-0000-0000-0000-000000000001');
delete from unit_reservations where vehicle_unit_id in (select id from vehicle_units where organization_id = 'de000000-0000-0000-0000-000000000001');
delete from listings       where organization_id = 'de000000-0000-0000-0000-000000000001';
delete from vehicle_units  where organization_id = 'de000000-0000-0000-0000-000000000001';
delete from locations      where organization_id = 'de000000-0000-0000-0000-000000000001';
delete from organizations  where id = 'de000000-0000-0000-0000-000000000001';
