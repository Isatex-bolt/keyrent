import Link from "next/link";

export const metadata = { title: "Anteprime V2" };

const ITEMS = [
  { href: "/preview/customer-header-v2", title: "Cliente: header e accesso V2", text: "Nome e avatar in alto, niente etichetta “Cliente”, dopo l'accesso si resta in home.", now: "/" },
  { href: "/preview/provider-dashboard-v2", title: "Noleggiatore: dashboard V2", text: "“Cosa devo fare oggi?”: KPI, ritiri e rientri, ricavi, flotta, disponibilità.", now: "/pro" },
  { href: "/preview/provider-fleet-v2", title: "Noleggiatore: i miei mezzi V2", text: "Catalogo flotta con filtri, schede / lista / calendario e scheda mezzo in sola lettura.", now: "/pro/mezzi" },
  { href: "/preview/provider-calendar-v2", title: "Noleggiatore: calendario disponibilità V2", text: "Calendario del singolo mezzo e vista flotta (righe = mezzi, colonne = giorni).", now: null },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Anteprime V2</h1>
        <p className="mt-2 text-mute">
          Proposte da confrontare con le pagine attuali. Con un account noleggiatore vedi i tuoi dati veri; aggiungi
          <code className="mx-1 rounded bg-navy-50 px-1.5 py-0.5 text-sm">?demo=1</code> per vedere una flotta di esempio piena.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <div key={i.href} className="card flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div><h2 className="font-semibold">{i.title}</h2><p className="mt-1 text-sm text-mute">{i.text}</p></div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={i.href} className="btn-primary px-4 py-2 text-sm">Apri V2</Link>
              <Link href={`${i.href}?demo=1`} className="btn-ghost">Con dati di esempio</Link>
              {i.now && <Link href={i.now} className="btn-ghost">Versione attuale</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
