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
