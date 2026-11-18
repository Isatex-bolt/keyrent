-- Ricerca per area (0010)
\set ON_ERROR_STOP 1
select date_trunc('day', now()) + interval '200 days 9 hours' as p, date_trunc('day', now()) + interval '202 days 9 hours' as r \gset
set role anon;
-- riquadro attorno a Padova (contiene le sedi di A, non Vicenza di B)
select test.ok((select count(*) = 3 from public.search_map(11.80, 45.35, 12.00, 45.45)), 'riquadro su Padova: solo gli annunci di Padova');
select test.ok((select count(*) = 0 from public.search_map(11.80, 45.35, 12.00, 45.45) where city = 'Vicenza'), 'Vicenza fuori dal riquadro');
select test.ok((select total_cents = 50000 from public.search_map(p_pickup => :'p', p_return => :'r', p_category => 'camper')),
               'il camper mostra il totale per 2 giorni (€500)');
select test.ok((select total_cents is null and price_from_cents is not null from public.search_map(p_category => 'camper')),
               'senza date: niente totale, solo prezzo da');
select test.ok((select count(*) = 0 from public.search_map(p_pickup => :'p', p_return => (:'p'::timestamptz + interval '2 hours'), p_category => 'camper')),
               'durata sotto il minimo del noleggiatore: il mezzo non compare');
select test.ok((select count(*) = 0 from public.search_map(p_instant_only => true)), 'filtro ⚡: nessun annuncio con prenotazione immediata nei dati di prova');
select test.ok((select count(*) = 1 from public.search_map(p_pickup => :'p', p_return => :'r', p_price_max_cents => 50000, p_category => 'camper')),
               'prezzo massimo applicato sul totale');
select test.fails($$select private.safe_quote_total(gen_random_uuid(), now(), now())$$, 'permission denied', 'la funzione interna non è pubblica');
reset role;
