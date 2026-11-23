import Link from "next/link";

export const metadata = { title: "Anteprime esperienza cliente" };

const ITEMS: [string, string, string, string | null][] = [
  ["/preview/customer-onboarding", "1–2 · Registrazione", "Voglio noleggiare / Metto mezzi a noleggio, poi Privato / Azienda.", "/registrati"],
  ["/preview/customer-home", "3–4 · Home cliente e barra in basso", "Home dopo l'accesso, noleggio in corso in evidenza, barra a 5 voci su telefono.", "/"],
  ["/preview/customer-search", "Cerca in 3 passi", "Dove → Quando → Cosa → risultati (porta alla ricerca vera).", "/cerca"],
  ["/preview/customer-dashboard", "5 · Il mio KeyRent", "Ciao Filippo, noleggi attivi, in attesa, prossimi, spesa del mese.", "/account"],
  ["/preview/customer-rentals", "6–8 · I miei noleggi", "Attivi, In attesa, Futuri, Completati, Cancellati. Dentro: noleggio attivo e richiesta in attesa.", "/account"],
  ["/preview/customer-messages", "9 · Messaggi", "Lista conversazioni come un'app di messaggi.", "/messaggi"],
  ["/preview/customer-profile", "10 · Profilo", "Account, azienda, preferenze, KeyRent, esci. Passa all'area noleggiatore.", "/account"],
  ["/preview/business-renter-dashboard?contesto=azienda", "11 · Dashboard azienda", "Spesa mese e anno, noleggi attivi, futuri, in attesa, per categoria.", null],
  ["/preview/business-billing?contesto=azienda", "12 · Dati di fatturazione azienda", "Ragione sociale, P.IVA, SDI, PEC, indirizzo, email amministrativa.", null],
];

export default function Page() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Anteprime esperienza cliente</h1>
        <p className="mt-1 text-sm text-mute">Aprile dal telefono per vederle come un cliente. Con l&apos;accesso vedi i tuoi dati; aggiungi <code className="rounded bg-navy-50 px-1">?demo=1</code> per dati di esempio pieni.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map(([href, title, text, now]) => (
          <div key={href} className="card flex flex-col gap-3 p-4">
            <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-mute">{text}</p></div>
            <div className="mt-auto flex flex-wrap gap-2 text-sm">
              <Link href={href} className="btn-primary px-4 py-2 text-sm">Apri</Link>
              <Link href={`${href}${href.includes("?") ? "&" : "?"}demo=1`} className="btn-ghost">Con esempio</Link>
              {now && <Link href={now} className="btn-ghost">Attuale</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
