# KeyRent.it

Marketplace italiano di noleggio mezzi. Questo repository contiene, per ora, la **Fase 0**: database, regole di sicurezza e test.
Il documento di progettazione è su Claude: *KeyRent.it — Product & Technical Design v0.1*.

## Struttura

```
supabase/
  migrations/
    …0100_foundation.sql          profili, staff interno, organizzazioni, sedi, audit log
    …0200_catalog_listings.sql    catalogo, mezzi fisici, annunci, revisioni, prezzi, commissioni
    …0300_bookings_payments.sql   disponibilità (anti double booking), prenotazioni, pagamenti, payout, ledger
    …0400_workflow_messaging.sql  workflow annunci, chat con filtro contatti, notifiche, recensioni
    …0500_rls_public_api.sql      RLS e privilegi di colonna, viste pubbliche, ricerca, dati sbloccati per fase
  seed.sql                        categorie, attributi, catalogo di esempio, policy di cancellazione v1, commissione 5%
tests/db/
  run.sh                          avvia un PostgreSQL 16 temporaneo ed esegue tutto
  05_fixtures.sql                 2 provider, clienti, staff, annunci pubblicati tramite workflow
  10_isolation.sql                isolamento tra provider e permessi (ruoli anon/authenticated reali)
  20_booking_flow.sql             prenotazione → pagamento → payout, cancellazioni, pool, scadenze, ricerca
  30_concurrency.sh               20 prenotazioni in parallelo sullo stesso mezzo: ne passa una sola
```

## Test

```bash
tests/db/run.sh
```

Richiede PostgreSQL 16 (`/usr/lib/postgresql/16/bin`, modificabile con `PGBIN`). Stato attuale: **111 verifiche superate**.

## Regole chiave

- **Isolamento provider**: ogni tabella del provider ha `organization_id` e policy RLS; le FK composte impediscono di mettere un mezzo nella sede di un altro provider.
- **Niente stati finanziari dal frontend**: `bookings`, `payments`, `payouts`, `ledger_entries` non sono scrivibili dai ruoli client. Lo stato dell'annuncio (`listings.status`) non è scrivibile dal client.
- **Double booking impossibile**: vincolo di esclusione su `unit_reservations (vehicle_unit_id, period)`.
- **Dati del provider per fase**: anonimo → solo città e "verificato"; dopo l'accettazione → identità legale (`get_booking_provider_identity`); dopo il pagamento → indirizzo, telefono, istruzioni (`get_booking_pickup_details`).
- **Annunci pubblicati**: le modifiche a testi, specifiche e condizioni passano da una revisione; prezzi e calendario si aggiornano subito.
- **Policy di cancellazione versionate e immutabili**: ogni prenotazione conserva la versione accettata.
- **Ledger in partita doppia**: ogni gruppo di registrazioni somma a zero, controllato dal database.

## Funzioni per il server (service_role)

| Funzione | Quando |
| --- | --- |
| `private.create_booking_request` | Cliente invia la richiesta (crea l'hold) |
| `private.record_authorization` | Webhook `payment_intent.amount_capturable_updated` |
| `private.accept_booking` / `decline_booking` | Risposta del provider |
| `private.confirm_booking` | Dopo la capture Stripe riuscita |
| `private.mark_picked_up` / `mark_completed` / `mark_no_show` | Ritiro, riconsegna, mancato ritiro |
| `private.cancel_booking` → `mark_refund_succeeded` | Cancellazione e rimborso |
| `private.expire_stale_bookings` | Job ogni minuto |
| `private.claim_due_payouts` → `mark_payout_paid` / `mark_payout_failed` | Job payout |
| `private.register_stripe_event` | Ogni webhook (idempotenza) |
| `private.listing_transition` / `propose_listing_changes` / `review_listing_changes` | Workflow annunci |

Funzioni pubbliche (via Supabase RPC): `search_listings`, `quote`, `listing_busy_days`, `start_conversation`, `send_message`,
`leave_review`, `create_organization`, `get_booking_provider_identity`, `get_booking_pickup_details`.

## Applicare a Supabase

1. Crea un progetto Supabase **dedicato a KeyRent** (regione EU, Francoforte).
2. `supabase link --project-ref <ref>` e poi `supabase db push` (applica `supabase/migrations`).
3. Esegui `supabase/seed.sql` dall'SQL editor.
4. Non applicare `tests/db/00_supabase_stub.sql`: serve solo in locale.

## Note

- Per le distanze si usa `earthdistance` (disponibile su Supabase); PostGIS si può aggiungere se servono poligoni/aree.
- Valori provvisori da confermare: commissione 5%, percentuali di cancellazione (validazione legale), minimo 4 foto per annuncio.
