# KeyRent.it — contesto di progetto

Rispondi in italiano. L'utente non è uno sviluppatore: istruzioni passo passo, niente gergo inutile,
mai chiedergli di aprire file sul Mac (non ha editor): se deve incollare qualcosa, mettilo direttamente in chat.

## Prodotto
Marketplace italiano di noleggio mezzi (auto, moto, bici, camper, barche, furgoni, quad/motoslitte).
Solo provider professionali. KeyRent incassa e trattiene una commissione, paga il provider ~24 h dopo il ritiro.
Documento di progettazione: "KeyRent.it — Product & Technical Design v0.1" (Claude Docs dell'utente).

## Decisioni prese (18/11/2026)
- D1: prima della prenotazione il provider è anonimo ("Noleggiatore professionale verificato" + città).
  Dopo l'accettazione: identità legale (ragione sociale, P.IVA). Dopo il pagamento: indirizzo, telefono, istruzioni.
- D2: preautorizzazione carta alla richiesta → provider accetta (24 h) → cliente conferma → capture → payout a ritiro + 24 h.
- D3: `vehicle_units` (mezzo fisico) separato da `listings` (offerta). Modalità `single` o `pool` (es. 20 bici identiche:
  la disponibilità scende a ogni prenotazione, esaurito solo quando tutte sono fuori).
- Commissione: per categoria + override per provider (`commission_rules`). Valori ancora da decidere; ora 5% globale.
- Dati del vecchio sito Bolt: solo prove, si parte puliti.

## Stack
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · Supabase (progetto KEYRENT, org ISATEX SRL, regione EU,
URL https://njwgcoxrtdpllonuyjyv.supabase.co) · Stripe Connect (Express, separate charges and transfers, TEST MODE) ·
Vercel · worker per job (scadenze, payout, email). Brand: blu navy + turchese, moderno, premium, mobile first.

## Stato
- Fase 0 FATTA: `supabase/migrations` + `seed.sql` applicati al progetto Supabase reale (38 tabelle, 47 funzioni private).
  Test: `tests/db/run.sh` su PostgreSQL 16 locale (111 verifiche, incluse 20 prenotazioni concorrenti).
- Fase 1a FATTA (online su https://keyrent.vercel.app, Vercel fra1, deploy automatico da main, root apps/web):
  home, ricerca server-side con filtri in URL, scheda mezzo. 8 annunci demo (org DEMO, rimuovibili con supabase/demo/demo_remove.sql).
- Fase 1b FATTA e provata dall'utente: auth Supabase, area noleggiatore (attività, sedi, wizard 7 passi, foto su Storage
  bucket "listings", invio revisione), area admin (revisione, anagrafiche). Migrazioni 0006 e 0007 applicate.
  L'utente è admin (staff_members) e ha una sua attività di prova.
- Fase 2a FATTA (18/11): badge (0009), selettore attività in /pro, ricerca mappa `public.search_map` (0010, bbox + totale per date + ⚡),
  nuova home (Prenota/Lungo termine), campo Dove con Mapbox Search Box (token pubblico NEXT_PUBLIC_MAPBOX_TOKEN su Vercel), /cerca con mappa,
  cluster, "Cerca in questa zona", pannello mobile a 3 altezze. api.mapbox.com non raggiungibile dalla sandbox: la mappa la prova l'utente.
- Email: dominio keyrent.it verificato su Resend (record DNS su Register.it, li gestisce l'utente). Supabase Auth usa SMTP Resend.
  Le notifiche partono da `lib/email.ts` (flushEmails) subito dopo le azioni (`sendEmailsSoon`, after()) e con il cron giornaliero
  /api/email/flush (CRON_SECRET). Senza RESEND_API_KEY restano pending.
- Assistenza (0016 `support_threads`/`support_messages`): /assistenza (clienti), /pro/assistenza, /admin/messaggi; email support_to_staff/support_reply.
  Account solo staff (info@keyrent.it): header con pill ADMIN, niente area cliente.
- Area noleggiatore V2 (23/11): menu a sezioni (components/ProNav), dashboard KPI (/pro), catalogo flotta con filtri e Dal/Al (/pro/mezzi),
  scheda mezzo in sola lettura (/pro/mezzi/[id]) + modifica (/pro/mezzi/[id]/modifica), calendario flotta e singolo (/pro/calendario).
  Dati: lib/v2/fleet.ts (sola lettura, RLS). Cliente: header senza etichetta, dopo l'accesso resta in home.
- Cliente V2 (23/11): barra in basso su telefono (components/v2/customer/BottomNav), home con noleggio in corso, /cerca/rapida,
  /account = Il mio KeyRent, /account/noleggi (schede), /account/profilo, /account/dati, /account/azienda (+ /dati fatturazione).
  0018: organizations.kind 'provider'|'renter' (azienda cliente: prenota, non pubblica), bookings.billing_organization_id,
  contesto Personale/Azienda nel cookie kr_ctx; prenota: "Prenotazione per" e patente/età solo per mezzi a motore.
- Pagamenti carta (0017, Stripe test): blocco alla richiesta, addebito all'accettazione del noleggiatore. Manca: payout Connect, webhook.
- Guida KeyRent (23/11): /guida (scelta), /guida/noleggiare (6 slide), /guida/noleggiatori (10 slide), components/guide/*,
  checklist "Inizia con KeyRent" in /pro (ProChecklist, localStorage), Hint su /account/noleggi, footer a colonne, eventi lib/analytics.ts.
  Slide da aggiornare quando saranno live: Apple/Google Pay, versamenti automatici al noleggiatore.
- Decisione 24/11: niente prenotazione immediata (⚡). Serve sempre la conferma del noleggiatore; badge, filtro e testi rimossi
  (la colonna listings.instant_book resta nel database, inutilizzata).
- Home stile Booking (24/11): menu categorie scorrevole in alto (Tutti…Lungo termine), riquadro ricerca compatto bordo turchese
  (Dove · Quando con date "sab 28 nov" · Cerca), scorciatoie Oggi/Domani/Weekend, "Continua la ricerca" (localStorage),
  "Cosa ti serve oggi?" riga compatta. /cerca: riepilogo bordo turchese + pillole categorie. Solo giorni, stesso giorno = 1 giorno.
- Checkout V2: preview sul ramo preview-checkout (/preview/booking-v2, tutto simulato). Utente ok a pubblicarlo a tappe;
  consegna solo se il noleggiatore la attiva (raggio km + prezzo al km + eventuale fisso), prezzo calcolato dalla distanza.
- Capacità separate (0019, 23/11): profiles.rents_personally = PRIVATO; organizations kind 'renter' = AZIENDA cliente;
  kind 'provider' = ATTIVITÀ DI NOLEGGIO. Nessuna capacità automatica (lib/auth getCapabilities). P.IVA unica per tipo
  (organizations_kind_vat_key). Profilo /account/profilo: card Privato / Azienda / Attività di noleggio; /account/privato
  aggiunge il profilo privato (enable_personal_renting). Prenota come: solo profili cliente; noleggiatore puro non prenota.
- Consegna (0020, 23/11): rental_terms.delivery_* (spunta, raggio km, fisso, al km); su annuncio online passa da revisione
  (trigger guard + applicata all'approvazione); public.listing_delivery per la scheda. Calcolo nel checkout: da fare (tappa 1 checkout V2).
- Staff (0021): lo staff può inviare in revisione bozze preparate per un noleggiatore. Admin: menu stile noleggiatore,
  /admin/profilo (ISATEX), /admin/anagrafiche/[id] (+ nuovo, annunci/[lid]) con app/admin/listingActions.ts. Foto catalogo rimossa.
  Header: account staff sempre ADMIN, mai area noleggiatore.
- Lungo termine (0022, 23/11): rental_terms short_term_enabled/long_term_enabled, lt_prices {"12".."48": cents/mese},
  lt_services {bollo,assicurazione,gomme,tagliandi,sostitutiva: {offered,cents}} (0 = incluso), lt_km_per_year, lt_extra_km_cents.
  lib/longTerm.ts, components/LongTermFields (wizard + modifica, revisione su online), LongTermConfigurator (scheda: rata live,
  "Richiedi questo noleggio" → messaggio precompilato). Ricerca lungo=1&durata: solo annunci lungo termine, "da X €/mese".
  Manca: richiesta/contratto lungo termine strutturati (oggi via messaggio).
- Scheda mezzo compatta (24/11): calendario KeyRent senza OK (components/RangePicker: DateRange/DateOne, giorni occupati barrati),
  prenotazione sotto il titolo, dettagli a scomparsa, lungo termine dietro un tasto. Consegna (0023 public.delivery_quote: linea d'aria,
  km arrotondati in su, fisso + km×prezzo): spunta "Consegna a casa"/"in azienda" (contesto kr_ctx) in BookingBox, /api/consegna;
  il link a /prenota porta consegna=1&c_lat&c_lng&c_ind. Da fare: /prenota deve ricalcolare e salvare la consegna.
- Fix collaudo 24/11 (report "KeyRent — Collaudo completo (QA)" nei Docs dell'utente, KR-xx): orari proposti
  lib/format defaultTimes/fixTimes (oggi: ritiro ≥ adesso+2 h; stesso giorno: riconsegna ≥ 18:00), login azienda cliente → home
  (solo attività kind 'provider' contano), blocco giorni in /pro/calendario "Singolo mezzo" (unit_reservations block/maintenance via RLS),
  0024 svc_mark_picked_up/returned/no_show + pulsanti in /pro/prenotazioni, doppio invio richiesta ripreso, contatti vietati
  in titolo/descrizione (lib/listingForm contactsIn), dashboard in ora di Roma. Pagamenti (KR-02/03/09/10/13/24, payout) = sessione serale.
- Account demo concessionari (25/11, 0025): link /demo (entra con un tocco), utente concessionario@keyrent.it / 123456
  (creato da Dashboard Supabase; lib/demo.ts, DEMO_PASSWORD opzionale su Vercel). organizations.is_demo, listings.demo_keep (10 esempi,
  protetti DEMO_PROTECTED), nessuna prenotazione vera (DEMO_LISTING), annunci creati in prova approvati dopo 30 s (svc_demo_autoapprove,
  after()), visibili solo nell'area demo di chi li crea (0028: fuori da public_listings) e cancellati dopo 24 h; noleggi finti pi_demo_ rigenerati ogni notte (private.demo_reset, chiamato dal cron /api/email/flush).
  Preparazione: supabase/demo/concessionario_setup.sql (cancella TUTTI gli annunci). Foto: /admin/demo → Carica foto (una per annuncio, fatte dall'utente con ChatGPT; sostituisce le precedenti).
  DemoBanner in /pro + DemoNudge (popup dopo 5 min o su ?demo=nonsalvato). demoStop(): nella demo attività/profili/azienda non si salvano → /pro?demo=nonsalvato. Accettare/rifiutare richieste finte non tocca Stripe (pi_demo_).
- Demo personali (0027, 25/11): /demo → enterDemo crea un utente demo-xxx@prova.keyrent.it (auth admin) + private.demo_clone
  (copia org/sedi/10 annunci con stesse foto/noleggi finti, organizations.demo_clone_of, listings.demo_source_id). Le copie non sono
  nella vista public_listings; private.demo_cleanup le cancella dopo 24 h (dal cron via svc_demo_reset). Max 300 copie, poi account condiviso.
  Cookie kr_demo (enterDemo): proxy.ts rimanda registrati/account/prenota/diventa-partner/… a /pro e /accedi a /demo; DemoBar su tutto
  il sito ("Demo · Torna alla tua area"), DemoNudge dopo 3 min e poi ogni 5; /esci e la registrazione tolgono il cookie.
- 25/11 sera: 0029 public.provider_reviews (recensioni clienti sul noleggiatore, anonimo, in scheda mezzo; sui demo "di esempio"),
  risultati su telefono a schede orizzontali (ListingCard row), pulsanti prenota tutti turchesi (btn-primary), barre fisse in basso
  con fondo bianco fino al bordo, mappa /cerca alta 100svh (niente rimbalzi con la barra di Safari).
- 26/11: 0030 organizations.is_premium (staff: "Rendi Premium" in /admin/anagrafiche/[id]) + public.listing_ratings: schede risultati
  con voto/recensioni del mezzo (vuoto se nessuna) e badge Premium al posto di "Paghi solo se confermato".
- KeyRent Select (26/11, sempre in 0030): listings.is_select (solo staff: "Metti in Select" in /admin/anagrafiche/[id]/annunci/[lid];
  marche di lusso automatiche via trigger private.auto_select_listing, lista anche in lib/select.ts). Ricerca /cerca?select=1 = sezione
  Select (banda blu notte/oro); nella ricerca normale i Select sono esclusi e compare l'invito "N mezzi esclusivi →".
  marca=ferrari & co. reindirizza a select=1. Pillola "✦ Select" in home e /cerca. Prossimo: preventivi per jet/elicotteri/NCC.
- 0031 (26/11): categorie solo Select ncc / jet / elicotteri (lib/catalog SELECT_CATEGORIES, prezzo "/ ora", fuori dalle pillole normali,
  cat=jet → select=1), trigger auto Select anche per categoria, fix overflow commissione (v_total::numeric) in create_booking_request
  e demo_seed_bookings. Demo: supabase/demo/select_setup.sql = 6 annunci Select n. 11–16 (Vito NCC, Ferrari 296, Huracán, GT3 RS,
  Phenom 300E a Linate, AW109 a Cortina) + sedi Milano e Linate. 0031 aggiunge anche 4 idee Select in home_collections
  (angolo nero ✦ Select in HomeTiles quando query contiene select=1).
- PRE-LANCIO (26/11): prenotazioni chiuse finché su Vercel non c'è BOOKINGS_OPEN=1 (lib/launch.ts): requestBooking rimanda,
  /prenota mostra "Le prenotazioni non sono ancora attive", scheda con avviso. Registrazione noleggiatori e annunci restano aperti.
  Email: destinatari @demo/@prova.keyrent.it e concessionario@keyrent.it → skipped "account demo" (niente rimbalzi).
- 0026 (25/11): basta una foto per inviare un annuncio in revisione (prima 4). Foto AI tolte dall area noleggiatore (restano solo nei contenuti home admin).
- Prossimo (spec Product Experience): attributi tipizzati + catalogo/alias; consegna a domicilio; Stripe (wallet, capture); preventivo lungo termine.
- Poi: prenotazione (richiesta → accettazione → conferma) con Stripe Connect in test mode; area cliente prenotazioni;
  richieste/prenotazioni nell'area noleggiatore; chat; email (serve SMTP: oggi Supabase manda solo agli indirizzi del team).
- Nota operativa: l'utente applica le migrazioni incollando SQL nell'editor di Supabase. Blocchi corti (< ~150 righe),
  niente tabelle temporanee (l'editor non mantiene la sessione), sempre rieseguibili.
- Nota: da questa sandbox *.supabase.co non è raggiungibile (rete limitata ai package manager): verifiche via test locali + utente.

## Regole tecniche da rispettare
- Mai cambiare stati di prenotazioni/pagamenti/annunci dal client: solo funzioni `private.*` chiamate dal server
  con la service role. Il client usa la chiave pubblica + RLS.
- Ogni nuova tabella: `revoke all ... from anon, authenticated`, abilitare RLS, policy esplicite, test di isolamento.
- Prezzi sempre ricalcolati dal server (`private.quote_listing`), mai fidarsi degli importi del client.
- Webhook Stripe: firma verificata + `private.register_stripe_event` per l'idempotenza.
- Email: mai simulare l'invio; `email_deliveries` resta `pending` finché non c'è un provider configurato.
- Secret (service role, Stripe secret) solo nelle variabili d'ambiente di Vercel, mai nel codice o in chat.
