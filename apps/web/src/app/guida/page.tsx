import Link from "next/link";
import { GuideOpened } from "@/components/guide/GuideOpened";

export const metadata = {
  title: "Guida KeyRent",
  description: "Come funziona KeyRent in un minuto: per chi noleggia un mezzo e per chi mette a noleggio la propria flotta.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-6 sm:pt-16">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">Guida KeyRent</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Come vuoi usare KeyRent?</h1>
      <p className="mt-2 text-[15px] text-mute sm:text-base">Scegli il percorso: bastano meno di due minuti.</p>
      <Cards />
      <GuideOpened />
    </div>
  );
}

function Cards() {
  const cards = [
    { slug: "noleggiare", eyebrow: "Per chi noleggia", title: "Voglio noleggiare", text: "Cerca, prenota e gestisci i tuoi noleggi.", steps: "6 passaggi", mark: "K" },
    { slug: "noleggiatori", eyebrow: "Per chi mette a noleggio", title: "Metto mezzi a noleggio", text: "Pubblica i tuoi mezzi, gestisci la disponibilità e ricevi nuove prenotazioni.", steps: "10 passaggi", mark: "R" },
  ] as const;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {cards.map((c) => {
        return (
          <Link key={c.slug} href={`/guida/${c.slug}`}
            className={`group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-3xl p-6 transition active:scale-[0.99] sm:min-h-72 sm:p-8 ${
              c.slug === "noleggiatori" ? "bg-navy-900 text-white" : "border border-line bg-white text-ink"}`}>
            <div>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${c.slug === "noleggiatori" ? "text-teal-400" : "text-teal-600"}`}>{c.eyebrow}</p>
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h2>
              <p className={`mt-2 max-w-sm text-[15px] ${c.slug === "noleggiatori" ? "text-white/70" : "text-mute"}`}>{c.text}</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className={`text-sm ${c.slug === "noleggiatori" ? "text-white/60" : "text-mute"}`}>{c.steps}</span>
              <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-teal-500 px-5 text-[15px] font-semibold text-navy-950 transition group-hover:bg-teal-400">
                Scopri come funziona <span aria-hidden>→</span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
