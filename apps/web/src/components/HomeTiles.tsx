import Image from "next/image";
import Link from "next/link";
import { type Collection, type Destination, TILE_EMOJI, TILE_GRADIENT } from "@/lib/content";

/** Riquadri "per esigenza": il primo grande, gli altri in griglia. */
export function CollectionTiles({ items }: { items: Collection[] }) {
  return (
    <div className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[200px] lg:grid-cols-4">
      {items.map((c, i) => (
        <Link key={c.slug} href={`/cerca${c.query ? `?${c.query}` : ""}`}
          className={`group relative overflow-hidden rounded-3xl ${i === 0 ? "col-span-2 row-span-2" : i === 1 ? "col-span-2" : i >= 4 ? "lg:col-span-2" : ""}`}>
          {c.image
            ? <Image src={c.image} alt="" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
            : <div className={`absolute inset-0 bg-gradient-to-br ${TILE_GRADIENT[c.slug] ?? "from-navy-900 to-teal-500"}`}>
                <span aria-hidden className={`absolute -right-3 -top-4 opacity-25 transition duration-500 group-hover:scale-110 ${i === 0 ? "text-[170px]" : "text-[110px]"}`}>{TILE_EMOJI[c.slug] ?? "🔑"}</span>
              </div>}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <p className={`font-bold leading-tight text-white ${i === 0 ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"}`}>{c.title}</p>
            <p className={`mt-1 text-white/80 ${i === 0 ? "text-sm sm:text-base" : "line-clamp-2 text-xs sm:text-sm"}`}>{c.subtitle}</p>
          </div>
          <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">→</span>
        </Link>
      ))}
    </div>
  );
}

export function DestinationCard({ d, wide = false }: { d: Destination; wide?: boolean }) {
  return (
    <Link href={`/destinazioni/${d.slug}`} className={`group relative block overflow-hidden rounded-3xl ${wide ? "aspect-[16/10]" : "aspect-[3/4]"}`}>
      {d.image
        ? <Image src={d.image} alt={d.name} fill sizes="(min-width:1024px) 25vw, 70vw" className="object-cover transition duration-500 group-hover:scale-105" />
        : <div className="absolute inset-0 bg-gradient-to-br from-navy-800 via-navy-700 to-teal-500" />}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">{d.region}</p>
        <p className="text-lg font-bold leading-tight text-white">{d.name}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-white/80">{d.tagline}</p>
      </div>
    </Link>
  );
}
