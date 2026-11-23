import Link from "next/link";
import { Suspense } from "react";
import { HomeSearch } from "@/components/SearchForm";
import { HomeStatus } from "@/components/v2/customer/HomeStatus";
import { ListingCard } from "@/components/ListingCard";
import { searchMap } from "@/lib/data";
import { listingHref } from "@/lib/urls";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { getCollections, getDestinations } from "@/lib/content";
import { CollectionTiles, DestinationCard } from "@/components/HomeTiles";
import { NearMe } from "@/components/NearMe";

const steps = [
  { t: "Cerca", d: "Indica dove e quando ti serve il mezzo: vedi solo ciò che è davvero disponibile in quelle date." },
  { t: "Richiedi", d: "Invii la richiesta con la carta: viene solo preautorizzata, nessun addebito finché il noleggiatore non conferma." },
  { t: "Ritira", d: "Confermi e paghi in sicurezza su KeyRent. Ricevi indirizzo, contatti e istruzioni per il ritiro." },
];

export default function Home() {
  return (
    <>
      <Suspense><HomeStatus /></Suspense>
      <section className="relative overflow-hidden bg-navy-900">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(2,168,169,0.25),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-teal-400">Noleggio da professionisti verificati</p>
          <h1 className="max-w-2xl text-[34px] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Il mezzo giusto, quando e dove ti serve.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/70 sm:text-lg">
            Auto, moto, bici, camper, barche e furgoni. Disponibilità reale, prezzo chiaro, pagamento protetto.
          </p>
          <div id="cerca" className="card mt-8 scroll-mt-24 p-4 shadow-xl shadow-navy-950/30 sm:p-6">
            <HomeSearch />
          </div>
          <NearMe className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20" />
        </div>
      </section>

      <Suspense fallback={<RowSkeleton />}>
        <Ideas />
      </Suspense>

      <Suspense fallback={<RowSkeleton />}>
        <Latest />
      </Suspense>

      <Suspense fallback={null}>
        <Destinations />
      </Suspense>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-navy-900 px-6 py-10 sm:px-10 sm:py-14">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(2,168,169,0.3),transparent_60%)]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-400">Un solo posto, tutti i mezzi</p>
              <h2 className="mt-2 max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">Noleggia qualsiasi cosa. Da chi lo fa di mestiere.</h2>
              <p className="mt-3 max-w-lg text-white/70">Dall&apos;e-bike per il weekend al furgone per il trasloco: scegli date e luogo, al resto pensa KeyRent.</p>
            </div>
            <a href="#cerca" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-500 px-7 text-base font-semibold text-navy-950 transition hover:bg-teal-400">
              Inizia subito <span aria-hidden>↑</span>
            </a>
          </div>
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

async function Latest() {
  if (!isSupabaseConfigured()) return null;
  const rows = (await searchMap({}).catch(() => [])).slice(0, 8);
  if (rows.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Appena arrivati</h2>
        <Link href="/cerca" className="text-sm font-semibold text-teal-600 hover:underline">Vedi tutti</Link>
      </div>
      <div className="-mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-6 pt-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 sm:scroll-px-6">
        {rows.map((r) => (
          <div key={r.id} className="w-[78%] flex-none snap-start sm:w-[45%] lg:w-[23.5%]">
            <ListingCard r={r} href={listingHref(r)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RowSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl gap-4 overflow-hidden px-4 pt-14 sm:px-6">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/3] w-[78%] flex-none animate-pulse rounded-2xl bg-white sm:w-[45%] lg:w-[23.5%]" />)}
    </div>
  );
}

async function Ideas() {
  if (!isSupabaseConfigured()) return null;
  const items = await getCollections();
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Idee</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Cosa ti serve oggi?</h2>
      <div className="mt-6"><CollectionTiles items={items} /></div>
    </section>
  );
}

async function Destinations() {
  if (!isSupabaseConfigured()) return null;
  const items = await getDestinations();
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Ispirazione</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dove andare</h2>
        </div>
        <Link href="/destinazioni" className="text-sm font-semibold text-teal-600 hover:underline">Tutte le mete</Link>
      </div>
      <div className="-mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-6 pt-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 sm:scroll-px-6">
        {items.map((d) => (
          <div key={d.slug} className="w-[62%] flex-none snap-start sm:w-[36%] lg:w-[23.5%]"><DestinationCard d={d} /></div>
        ))}
      </div>
    </section>
  );
}
