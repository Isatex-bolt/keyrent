import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestination, destinationSearchHref } from "@/lib/content";
import { searchMap } from "@/lib/data";
import { categoryName } from "@/lib/catalog";
import { listingHref } from "@/lib/urls";
import { ListingCard } from "@/components/ListingCard";
import { CategoryIcon } from "@/components/CategoryIcon";

export async function generateMetadata({ params }: PageProps<"/destinazioni/[slug]">): Promise<Metadata> {
  const d = await getDestination((await params).slug);
  return d ? { title: `Noleggio a ${d.name}: ${d.tagline}`, description: d.description } : {};
}

export default function Page({ params }: PageProps<"/destinazioni/[slug]">) {
  return <Suspense fallback={<div className="h-[60vh] animate-pulse bg-navy-900" />}><Destination params={params} /></Suspense>;
}

async function Destination({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getDestination((await params).slug);
  if (!d) notFound();
  const rows = await Promise.all(d.categories.map(async (cat) => ({
    cat, items: await searchMap({ lat: d.latitude, lng: d.longitude, radiusKm: d.radius_km, category: cat, sort: "distance", limit: 8 }).catch(() => []),
  })));
  const found = rows.filter((r) => r.items.length > 0);

  return (
    <>
      <section className="relative overflow-hidden bg-navy-900">
        {d.image && <Image src={d.image} alt={d.name} fill priority sizes="100vw" className="object-cover opacity-70" />}
        {!d.image && <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(2,168,169,0.35),transparent_60%)]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/30 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pt-40">
          <Link href="/destinazioni" className="text-sm font-semibold text-teal-300 hover:underline">← Tutte le mete</Link>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-teal-300">{d.region}</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-white sm:text-5xl">{d.name}</h1>
          <p className="mt-2 text-lg text-white/85">{d.tagline}</p>
          <p className="mt-4 max-w-2xl text-white/75">{d.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={destinationSearchHref(d)} className="btn-primary">Vedi tutti i mezzi sulla mappa</Link>
            {d.categories.map((c) => (
              <Link key={c} href={destinationSearchHref(d, c)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                <CategoryIcon slug={c} className="h-4 w-4" />{categoryName(c)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
        {found.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <p className="text-lg font-semibold">Stiamo cercando noleggiatori in questa zona</p>
            <p className="mt-1 text-sm text-mute">Hai un noleggio vicino a {d.name}? Pubblica i tuoi mezzi su KeyRent.</p>
            <Link href="/diventa-partner" className="btn-primary mt-5">Diventa partner</Link>
          </div>
        )}
        {found.map((r) => (
          <section key={r.cat}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold tracking-tight">{categoryName(r.cat)} vicino a {d.name}</h2>
              <Link href={destinationSearchHref(d, r.cat)} className="text-sm font-semibold text-teal-600 hover:underline">Vedi tutti</Link>
            </div>
            <div className="-mx-4 mt-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 sm:scroll-px-6">
              {r.items.map((x) => (
                <div key={x.id} className="w-[78%] flex-none snap-start sm:w-[45%] lg:w-[23.5%]"><ListingCard r={x} href={listingHref(x)} /></div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
