import Link from "next/link";
import { SCENARIOS } from "@/components/preview/scenarios";

const PATHS = { instant: "instant", auto: "auto", request: "request", business: "business" } as const;

export default function Page() {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <div className="bg-navy-950 px-4 py-2 text-xs font-semibold tracking-wide text-white">PREVIEW · dati di prova, nessun pagamento reale</div>
      <div className="mx-auto max-w-xl space-y-5 px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Checkout V2</h1>
          <p className="mt-1 text-[15px] text-mute">Scegli uno scenario. Tocca Prenota e prova tutto il percorso con una mano. In alto a destra, &quot;Prove&quot; per cambiare portafoglio, simulare un pagamento rifiutato e vedere gli eventi registrati.</p>
        </div>
        <div className="grid gap-3">
          {Object.values(SCENARIOS).map((s) => (
            <Link key={s.key} href={`/preview/booking-v2/${PATHS[s.key]}`} className="card block p-5 transition hover:border-navy-700/30 active:scale-[0.99]">
              <p className="font-semibold">{s.label}</p>
              <p className="mt-1 text-sm text-mute">{s.blurb}</p>
              <p className="mt-3 text-sm font-semibold text-teal-600">{s.title} · {s.mode === "instant" ? "⚡ immediata" : "su richiesta"} →</p>
            </Link>
          ))}
        </div>
        <div className="space-y-2 rounded-2xl bg-white p-5 text-sm text-mute">
          <p className="font-semibold text-ink">Cosa è finto (MOCK) e cosa è reale</p>
          <p><span className="font-semibold text-ink">MOCK:</span> mezzi, prezzi, utente, indirizzi, patente, fogli Apple Pay / Google Pay / Link, campi carta, esito del pagamento, risposta del noleggiatore.</p>
          <p><span className="font-semibold text-ink">REALE:</span> solo l&apos;interfaccia. Nessuna chiamata a Stripe, nessuna scrittura nel database, nessuna email.</p>
          <p>Il riconoscimento del portafoglio è reale: su iPhone vedi Apple Pay, su Android Google Pay, sul computer solo Link e carta (puoi forzarlo da &quot;Prove&quot;).</p>
        </div>
      </div>
    </div>
  );
}
