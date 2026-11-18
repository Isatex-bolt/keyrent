import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CATEGORIES } from "@/lib/catalog";

const steps = [
  { t: "Cerca", d: "Indica dove e quando ti serve il mezzo: vedi solo ciò che è davvero disponibile in quelle date." },
  { t: "Richiedi", d: "Invii la richiesta con la carta: viene solo preautorizzata, nessun addebito finché il noleggiatore non conferma." },
  { t: "Ritira", d: "Confermi e paghi in sicurezza su KeyRent. Ricevi indirizzo, contatti e istruzioni per il ritiro." },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-900">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(18,194,181,0.22),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-teal-400">Noleggio da professionisti verificati</p>
          <h1 className="max-w-2xl text-[34px] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Il mezzo giusto, quando e dove ti serve.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/70 sm:text-lg">
            Auto, moto, bici, camper, barche e furgoni. Disponibilità reale, prezzo chiaro, pagamento protetto.
          </p>
          <div className="card mt-8 p-4 shadow-xl shadow-navy-950/30 sm:p-5">
            <SearchForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight">Cosa vuoi noleggiare?</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/cerca?cat=${c.slug}`}
              className="card group flex flex-col items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-teal-500/60 hover:shadow-md">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-500 group-hover:text-navy-950">
                <CategoryIcon slug={c.slug} />
              </span>
              <span className="text-sm font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Come funziona</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-navy-900 text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-semibold">{s.t}</p>
                  <p className="mt-1 text-sm text-mute">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="card flex flex-col items-start justify-between gap-6 bg-navy-50 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Hai una flotta a noleggio?</h2>
            <p className="mt-1 text-sm text-mute">Pubblica gratis i tuoi mezzi: paghi solo una commissione sulle prenotazioni concluse.</p>
          </div>
          <Link href="/diventa-partner" className="btn-primary">Diventa partner</Link>
        </div>
      </section>
    </>
  );
}
