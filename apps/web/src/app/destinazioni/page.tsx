import { Suspense } from "react";
import { getDestinations } from "@/lib/content";
import { DestinationCard } from "@/components/HomeTiles";

export const metadata = { title: "Dove andare: mete e mezzi a noleggio", description: "Le mete più belle d'Italia e i mezzi a noleggio per viverle: e-bike, moto, barche, camper." };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Ispirazione</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Dove andare</h1>
      <p className="mt-2 max-w-2xl text-mute">Scegli la meta: ti mostriamo i noleggiatori vicini e i mezzi giusti per viverla.</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-white" />}><Grid /></Suspense>
    </div>
  );
}

async function Grid() {
  const items = await getDestinations();
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((d) => <DestinationCard key={d.slug} d={d} />)}
    </div>
  );
}
