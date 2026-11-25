import type { Metadata } from "next";
import { Suspense } from "react";
import { enterDemo } from "@/app/accedi/actions";
import { redirect } from "next/navigation";
import { SubmitOnce } from "@/components/SubmitOnce";
import { getUser } from "@/lib/auth";
import { isDemoUser } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Prova KeyRent come noleggiatore",
  description: "Entra nell'account di prova e guarda come gestiresti la tua flotta su KeyRent.",
  robots: { index: false },
};

const POINTS = [
  ["Dashboard", "Incassi del mese, noleggi in corso, ritiri e riconsegne di oggi."],
  ["Flotta e calendario", "10 mezzi di esempio su 3 sedi, con disponibilità giorno per giorno."],
  ["Richieste e prenotazioni", "Accetta una richiesta, segna la consegna e il rientro del mezzo."],
  ["Il tuo primo annuncio", "Crealo in pochi minuti: in prova viene approvato in 30 secondi e resta online 24 ore."],
];

export default function DemoPage({ searchParams }: PageProps<"/demo">) {
  return (
    <div data-demo-focus className="min-h-[calc(100dvh-4rem)] bg-navy-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">Per noleggiatori e concessionari</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Prova KeyRent come se fosse già la tua attività.</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">
            Un account di prova completo, con mezzi, noleggi e incassi di esempio. Nessuna registrazione, nessun dato da inserire.
          </p>
          <form action={enterDemo} className="mt-8 max-w-sm">
            <SubmitOnce className="w-full rounded-2xl bg-teal-400 px-6 py-4 text-lg font-semibold text-navy-950 hover:bg-teal-300" pendingText="Preparo la demo…">
              Entra nella demo
            </SubmitOnce>
          </form>
          <Suspense fallback={null}><DemoError searchParams={searchParams} /></Suspense>
          <p className="mt-4 text-sm text-white/60">La demo è solo tua: quello che provi non lo vede nessun altro. Dopo 24 ore si cancella da sola.</p>
        </div>
        <ul className="grid gap-3">
          {POINTS.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-teal-400 font-bold text-navy-950">{i + 1}</span>
              <span><span className="block font-semibold">{t}</span><span className="text-sm text-white/70">{d}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

async function DemoError({ searchParams }: { searchParams: PageProps<"/demo">["searchParams"] }) {
  const sp = await searchParams;
  // già dentro una demo: si torna lì invece di crearne un'altra
  const user = await getUser().catch(() => null);
  if (user && (await isDemoUser(user.id))) redirect("/pro");
  const e = typeof sp.errore === "string" ? sp.errore : null;
  return e ? <p className="mt-3 rounded-xl bg-red-500/15 p-3 text-sm text-red-100">{e}</p> : null;
}
