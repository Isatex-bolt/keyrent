import Link from "next/link";
import type { Metadata } from "next";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CATEGORIES } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Diventa partner: pubblica i tuoi mezzi a noleggio",
  description: "Auto, moto, bici, camper, barche e furgoni: pubblica gratis i tuoi mezzi su KeyRent e ricevi prenotazioni. Nessun canone, commissione solo sulle prenotazioni concluse.",
};

const benefits = [
  { icon: "🎯", t: "Clienti che cercano proprio te", d: "Chi cerca un'e-bike sul Grappa o un furgone per il trasloco trova i tuoi mezzi su mappa, per esigenza e per destinazione." },
  { icon: "🗓️", t: "Mai due prenotazioni sullo stesso mezzo", d: "La disponibilità è controllata in tempo reale, anche se hai 20 bici identiche: si esauriscono solo quando sono tutte fuori." },
  { icon: "🔒", t: "Pagamenti protetti", d: "Il cliente paga su KeyRent con carta. Tu ricevi l'importo 24 ore dopo il ritiro, al netto della commissione." },
  { icon: "💬", t: "Chat con il cliente", d: "Domande e dettagli si gestiscono nella chat di KeyRent. I tuoi contatti diretti li riceve solo chi ha prenotato e pagato." },
];

const tools = [
  ["Inserimento in 2 minuti", "Scrivi il modello (\"Ducato\", \"Kosmo\", \"Turbo Levo\") e categoria, tipologia e scheda si compilano da sole."],
  ["Importazione da Excel", "Hai 30 mezzi? Compili un file e li trovi tutti pronti come bozze."],
  ["Foto con l'AI", "Non hai ancora le foto? Crei un'immagine ambientata del modello in un clic, poi la sostituisci con le tue."],
  ["Più sedi e collaboratori", "Ogni mezzo ha la sua sede di ritiro; il tuo team lavora con il proprio accesso."],
  ["Richieste da approvare", "Ogni richiesta arriva con un numero rosso nel menu: la accetti o la rifiuti entro 24 ore."],
  ["Prezzi flessibili", "Ora, mezza giornata, giorno, settimana: al cliente proponiamo sempre la combinazione più conveniente."],
];

const steps = [
  ["Registrati", "Crea l'account noleggiatore e inserisci i dati dell'attività (ragione sociale e P.IVA)."],
  ["Verifica", "Controlliamo l'attività: su KeyRent ci sono solo noleggiatori professionali."],
  ["Pubblica", "Aggiungi i mezzi, uno alla volta o da Excel. Ogni annuncio viene revisionato prima di andare online."],
  ["Ricevi prenotazioni", "Accetti le richieste, consegni il mezzo e ricevi il pagamento."],
];

const faq = [
  ["Quanto costa?", "Pubblicare è gratuito e non ci sono canoni. Paghi solo una commissione sulle prenotazioni concluse, trattenuta automaticamente dall'incasso."],
  ["Chi può iscriversi?", "Solo attività professionali con partita IVA: autonoleggi, concessionari, noleggi di camper, bici, barche, furgoni, quad e motoslitte."],
  ["Devo rispondere subito alle richieste?", "Hai 24 ore per accettare o rifiutare. Finché non accetti, al cliente non viene addebitato nulla."],
  ["Posso continuare a noleggiare anche fuori da KeyRent?", "Certo. Potrai bloccare le date in cui un mezzo non è disponibile, così non riceverai richieste in quei giorni."],
  ["Chi gestisce cauzione e contratto?", "Cauzione, contratto di noleggio e consegna restano tuoi, con le tue condizioni, che il cliente vede prima di prenotare."],
  ["Il cliente vede subito il mio nome?", "No: prima della prenotazione vede \"Noleggiatore professionale verificato\" e la città. I tuoi dati completi li riceve solo dopo la conferma."],
];

export default function Page() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-900">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(2,168,169,0.3),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-400">Per noleggiatori professionali</p>
            <h1 className="mt-3 text-[34px] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Porta i tuoi mezzi davanti a chi li sta cercando.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/75">
              Auto, moto, bici, camper, barche e furgoni. Pubblichi gratis, ricevi prenotazioni con disponibilità reale e pagamento protetto.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/registrati?tipo=noleggiatore" className="btn-primary px-6 py-3.5 text-base">Registra la tua attività</Link>
              <Link href="/accedi?tipo=noleggiatore" className="inline-flex items-center rounded-xl px-5 py-3.5 font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">Accedi</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              {["Pubblicazione gratuita", "Nessun canone", "Commissione solo sul concluso"].map((t) => (
                <li key={t} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-[11px] font-bold text-navy-950">✓</span>{t}</li>
              ))}
            </ul>
          </div>

          {/* Anteprima di come il noleggiatore riceve una richiesta */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[3rem] bg-teal-500/20 blur-3xl" aria-hidden />
            <div className="relative space-y-3">
              <div className="glass rounded-3xl p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-navy-900 text-lg">🔑</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">KeyRent · adesso</p>
                    <p className="font-semibold text-navy-900">Nuova richiesta di prenotazione</p>
                  </div>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">1</span>
                </div>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Richiesta · KR-7Q2M</p>
                <p className="mt-1 text-lg font-bold">Specialized Turbo Levo × 2</p>
                <p className="text-sm text-mute">Sab 14 → Dom 15 giugno · Bassano del Grappa</p>
                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="text-sm text-mute">Totale</span><span className="text-2xl font-bold">€ 180</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <span className="rounded-xl bg-navy-50 py-2.5 text-center text-sm font-semibold text-navy-900">Rifiuta</span>
                  <span className="rounded-xl bg-teal-500 py-2.5 text-center text-sm font-semibold text-navy-950">Accetta</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Perché KeyRent</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.t} className="card p-6">
              <span className="text-3xl">{b.icon}</span>
              <p className="mt-3 text-lg font-bold">{b.t}</p>
              <p className="mt-1 text-mute">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Per tutti i tipi di noleggio</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <span key={c.slug} className="chip"><CategoryIcon slug={c.slug} className="h-4 w-4" />{c.name}</span>
            ))}
          </div>
          <h2 className="mt-12 text-2xl font-bold tracking-tight sm:text-3xl">Strumenti pensati per chi lavora</h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map(([t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="mt-1 grid h-6 w-6 flex-none place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-600">✓</span>
                <div><p className="font-semibold">{t}</p><p className="mt-0.5 text-sm text-mute">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Si parte in 4 passi</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-sm font-bold text-white">{i + 1}</span>
              <p className="mt-3 font-bold">{t}</p>
              <p className="mt-1 text-sm text-mute">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="grid gap-6 overflow-hidden rounded-3xl bg-navy-900 p-8 text-white sm:grid-cols-3">
          {[["€ 0", "per pubblicare i mezzi"], ["€ 0", "di canone mensile"], ["Solo %", "sulle prenotazioni concluse"]].map(([n, l]) => (
            <div key={l}><p className="text-4xl font-bold text-teal-400">{n}</p><p className="mt-1 text-white/75">{l}</p></div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Domande frequenti</h2>
          <div className="mt-6 divide-y divide-line">
            {faq.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}<span className="text-xl text-teal-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-mute">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Pronto a ricevere le prime prenotazioni?</h2>
            <p className="mt-1 text-white/70">La registrazione richiede pochi minuti.</p>
          </div>
          <Link href="/registrati?tipo=noleggiatore" className="btn-primary px-6 py-3.5 text-base">Registra la tua attività</Link>
        </div>
      </section>
    </>
  );
}
