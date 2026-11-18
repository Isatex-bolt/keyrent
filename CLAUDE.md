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
- Prossimo: Fase 1 — app Next.js: ricerca server-side con filtri in URL, scheda mezzo, auth, area provider
  (attività, sedi, mezzi con wizard, richieste, prenotazioni), revisione admin, prenotazione con Stripe test mode.

## Regole tecniche da rispettare
- Mai cambiare stati di prenotazioni/pagamenti/annunci dal client: solo funzioni `private.*` chiamate dal server
  con la service role. Il client usa la chiave pubblica + RLS.
- Ogni nuova tabella: `revoke all ... from anon, authenticated`, abilitare RLS, policy esplicite, test di isolamento.
- Prezzi sempre ricalcolati dal server (`private.quote_listing`), mai fidarsi degli importi del client.
- Webhook Stripe: firma verificata + `private.register_stripe_event` per l'idempotenza.
- Email: mai simulare l'invio; `email_deliveries` resta `pending` finché non c'è un provider configurato.
- Secret (service role, Stripe secret) solo nelle variabili d'ambiente di Vercel, mai nel codice o in chat.
