\set ON_ERROR_STOP 1
insert into catalog_images (category_id, storage_path) select id, 'catalog/camper.png' from categories where slug = 'camper';
set role anon;
select test.ok((select count(*) = 1 from public.public_catalog_images where category_slug = 'camper' and model_slug is null), 'anon legge le immagini di catalogo');
select test.fails($$insert into catalog_images (category_id, storage_path) select id, 'x' from categories limit 1$$, 'permission denied', 'anon non può aggiungere immagini');
reset role;
set role authenticated;
select test.fails($$delete from catalog_images$$, 'permission denied', 'un utente non può cancellarle');
reset role;
select test.fails($$insert into catalog_images (category_id, storage_path) select id, 'y' from categories where slug = 'camper'$$, 'duplicate key', 'una sola immagine generica per categoria');
set role anon;
select test.ok((select count(*) >= 0 from public.public_listing_media where is_indicative = false), 'la vista pubblica espone il flag immagine indicativa');
reset role;
