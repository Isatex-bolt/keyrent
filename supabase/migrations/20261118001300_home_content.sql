-- KeyRent · 0013 · Contenuti della home: esigenze ("Escursione in bici", "Sei in viaggio?"…) e destinazioni
create table if not exists public.home_collections (
  slug        text primary key,
  title       text not null,
  subtitle    text not null,
  query       text not null default '',          -- parametri di /cerca, es. cat=bici&sub=e-bike
  image_path  text,
  sort        integer not null default 100,
  active      boolean not null default true
);
create table if not exists public.destinations (
  slug        text primary key,
  name        text not null,
  region      text not null,
  tagline     text not null,
  description text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  radius_km   integer not null default 30,
  categories  text[] not null default '{}',
  image_path  text,
  sort        integer not null default 100,
  active      boolean not null default true
);
revoke all on public.home_collections, public.destinations from anon, authenticated;
alter table public.home_collections enable row level security;
alter table public.destinations enable row level security;
drop policy if exists home_collections_read on public.home_collections;
create policy home_collections_read on public.home_collections for select to anon, authenticated using (active);
drop policy if exists destinations_read on public.destinations;
create policy destinations_read on public.destinations for select to anon, authenticated using (active);
grant select on public.home_collections, public.destinations to anon, authenticated;

insert into public.home_collections (slug, title, subtitle, query, sort) values
  ('escursione-in-bici', 'Escursione in bici', 'E-bike e mountain bike per salire in quota senza fatica', 'cat=bici&sub=e-bike', 10),
  ('sei-in-viaggio', 'Sei in viaggio?', 'Un''auto o uno scooter appena arrivi in città', 'cat=auto', 20),
  ('weekend-in-camper', 'Weekend in camper', 'Parti venerdì, dormi dove vuoi, torni lunedì', 'cat=camper', 30),
  ('giornata-in-barca', 'Una giornata in barca', 'Gommoni e barche, anche senza patente', 'cat=barche', 40),
  ('mezzo-per-azienda', 'Un mezzo per la tua azienda', 'Furgoni e auto per giorni, settimane o mesi', 'cat=furgoni', 50),
  ('avventura', 'Avventura su neve e sterrato', 'Quad e motoslitte con noleggiatori esperti', 'cat=quad-motoslitte', 60)
on conflict (slug) do nothing;

insert into public.destinations (slug, name, region, tagline, description, latitude, longitude, radius_km, categories, sort) values
  ('monte-grappa', 'Monte Grappa', 'Veneto', 'In e-bike fino a Cima Grappa',
   'Salite leggendarie da Bassano e dalla pedemontana, panorami sulla pianura veneta e sulle Prealpi. Con una e-bike la cima è alla portata di tutti.',
   45.80, 11.76, 30, '{bici,moto,auto}', 10),
  ('dolomiti-cortina', 'Dolomiti di Cortina', 'Veneto', 'Passi dolomitici in moto, bici o camper',
   'Le Tofane, le Cinque Torri e i passi più famosi delle Alpi. D''estate strade da moto e bici, d''inverno neve e motoslitte.',
   46.537, 12.136, 40, '{moto,bici,camper,quad-motoslitte}', 20),
  ('lago-di-garda', 'Lago di Garda', 'Lombardia · Veneto · Trentino', 'Lago, vento e ciclabili',
   'Dalla ciclabile sospesa di Limone alle colline della Valtènesi: in barca sul lago, in bici lungo la riva o in auto tra i borghi.',
   45.65, 10.68, 40, '{barche,bici,auto,moto}', 30),
  ('cinque-terre', 'Cinque Terre', 'Liguria', 'Borghi a picco sul mare',
   'Cinque borghi colorati tra terrazzamenti e mare. Il modo migliore per vederli tutti è dal mare, in barca o gommone.',
   44.146, 9.654, 30, '{barche,moto,auto}', 40),
  ('costiera-amalfitana', 'Costiera Amalfitana', 'Campania', 'La strada più bella d''Italia',
   'Positano, Amalfi e Ravello tra curve sul mare e calette raggiungibili solo in barca. Lo scooter è il mezzo perfetto.',
   40.634, 14.603, 35, '{moto,barche,auto}', 50),
  ('costa-smeralda', 'Costa Smeralda', 'Sardegna', 'Calette turchesi e arcipelago',
   'Spiagge di sabbia bianca, l''arcipelago della Maddalena e acqua cristallina. In gommone arrivi dove le auto non arrivano.',
   41.05, 9.52, 45, '{barche,auto,moto}', 60),
  ('chianti', 'Chianti', 'Toscana', 'Vigne, cipressi e strade bianche',
   'Tra Firenze e Siena, colline di vigneti e borghi medievali. In bici gravel o in auto cabrio, al ritmo giusto.',
   43.584, 11.316, 35, '{bici,auto,moto}', 70),
  ('lago-di-como', 'Lago di Como', 'Lombardia', 'Ville e motoscafi',
   'Bellagio, Varenna e le ville sul lago. Una giornata in motoscafo o una strada panoramica in moto.',
   45.985, 9.258, 35, '{barche,moto,auto}', 80),
  ('salento', 'Salento', 'Puglia', 'Due mari, una sola vacanza',
   'Dall''Adriatico allo Ionio, spiagge caraibiche e borghi barocchi. Camper e scooter per girarlo tutto.',
   40.20, 18.20, 60, '{camper,moto,auto,barche}', 90),
  ('langhe', 'Langhe', 'Piemonte', 'Colline del vino in bici e auto',
   'Barolo, Barbaresco e La Morra tra colline patrimonio UNESCO. Perfette in e-bike o con un''auto a noleggio.',
   44.62, 7.98, 35, '{bici,auto,camper}', 100)
on conflict (slug) do nothing;
