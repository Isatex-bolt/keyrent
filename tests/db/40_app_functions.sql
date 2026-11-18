-- Funzioni dell'app (0007): bozza annuncio atomica con RLS, tariffe, verifica, ponti service role.
\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select public.create_listing_draft('{
  "organization_id":"0a000000-0000-0000-0000-000000000001","location_id":"1a000000-0000-0000-0000-000000000001",
  "category":"bici","make":"cannondale","model":"topstone","title":"Gravel Cannondale Topstone",
  "description":"Bici gravel leggera e scorrevole, perfetta per strade bianche e lunghe uscite.",
  "attributes":{"electric":false,"frame_size":"L"},"quantity":20,
  "terms":{"deposit_cents":10000,"min_driver_age":16},
  "prices":[{"unit":"day","price_cents":3000},{"unit":"hour","price_cents":0}]}') as draft \gset
select test.ok((select quantity_mode = 'pool' and status = 'draft' and slug = 'gravel-cannondale-topstone' from listings where id = :'draft'),
               'bozza creata in modalità pool');
select test.ok((select count(*) = 20 from listing_units where listing_id = :'draft'), '20 bici create e collegate');
select test.ok((select count(*) = 1 from pricing_rules where listing_id = :'draft'), 'tariffe a zero ignorate');
select public.set_listing_prices(:'draft', '[{"unit":"day","price_cents":3200},{"unit":"week","price_cents":15000}]');
select test.ok((select count(*) = 2 and min(price_cents) = 3200 from pricing_rules where listing_id = :'draft'), 'tariffe sostituite');
select test.fails($$select private.listing_transition(gen_random_uuid(), 'published', gen_random_uuid())$$, 'permission denied',
                  'il browser non chiama le transizioni');
select test.fails($$select public.svc_listing_transition(gen_random_uuid(), 'published', gen_random_uuid())$$, 'permission denied',
                  'il browser non chiama i ponti riservati al server');

-- Provider B non può creare annunci nell'organizzazione A
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.fails($$select public.create_listing_draft('{"organization_id":"0a000000-0000-0000-0000-000000000001",
  "location_id":"1a000000-0000-0000-0000-000000000001","category":"auto","title":"Intruso"}')$$,
  'row-level security', 'provider B non crea bozze nell''organizzazione A');
select test.fails(format($$select public.set_listing_prices(%L, '[]')$$, :'draft'), 'FORBIDDEN', 'provider B non cambia i prezzi di A');
select test.fails($$select public.create_listing_draft('{"organization_id":"0b000000-0000-0000-0000-000000000001",
  "location_id":"1a000000-0000-0000-0000-000000000001","category":"auto","title":"Sede altrui"}')$$,
  'foreign key', 'provider B non usa la sede di A');
reset role; reset request.jwt.claim.sub;

-- Il server (service role) usa i ponti
set role service_role;
select test.fails(format($$select public.svc_listing_transition(%L, 'pending_review', %L)$$, :'draft', 'a0000000-0000-0000-0000-000000000001'),
                  'almeno 4 foto', 'invio in revisione senza foto: elenco di cosa manca');
insert into listing_media (listing_id, storage_path, sort) select :'draft', 'x/' || g || '.jpg', g from generate_series(1, 4) g;
select public.svc_listing_transition(:'draft', 'pending_review', 'a0000000-0000-0000-0000-000000000001');
select public.svc_listing_transition(:'draft', 'approved', 'd0000000-0000-0000-0000-000000000001');
select test.ok((select status = 'published' from listings where id = :'draft'), 'approvato dallo staff e pubblicato');
select test.fails($$select public.svc_set_org_verification('0b000000-0000-0000-0000-000000000001', 'suspended', 'a0000000-0000-0000-0000-000000000001')$$,
                  'FORBIDDEN', 'solo lo staff verifica le organizzazioni');
select public.svc_set_org_verification('0b000000-0000-0000-0000-000000000001', 'suspended', 'd0000000-0000-0000-0000-000000000001', 'test');
select test.ok((select verification_status = 'suspended' from organizations where id = '0b000000-0000-0000-0000-000000000001'), 'organizzazione sospesa dallo staff');
reset role;
update organizations set verification_status = 'verified' where id = '0b000000-0000-0000-0000-000000000001';
