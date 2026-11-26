import Image from "next/image";
import Link from "next/link";
import { LoopRow } from "./LoopRow";
import { type Collection, type Destination, TILE_EMOJI, TILE_GRADIENT } from "@/lib/content";

/** Angolo nero con la stellina: riconosce subito le idee KeyRent Select. */
function SelectCorner() {
  return (
    <span className="absolute left-0 top-0 z-10 flex items-center gap-1 rounded-br-2xl bg-navy-950 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
      <span aria-hidden>✦</span> Select
    </span>
  );
}
const isSelect = (c: Collection) => /(^|&)select=1(&|$)/.test(c.query ?? "");

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
          {isSelect(c) && <SelectCorner />}
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

const NEED_FALLBACK: Collection[] = ([
  { slug: "weekend", title: "Un'auto per il weekend", subtitle: "Dal venerdì alla domenica", query: "cat=auto" },
  { slug: "trasloco", title: "Un furgone per il trasloco", subtitle: "Anche per un giorno solo", query: "cat=furgoni" },
  { slug: "bici", title: "Una bici per oggi", subtitle: "E-bike e city bike", query: "cat=bici" },
  { slug: "vacanza", title: "Un camper per le vacanze", subtitle: "Libertà su quattro ruote", query: "cat=camper" },
  { slug: "mare", title: "Una barca per la giornata", subtitle: "Gommoni e barche senza patente", query: "cat=barche" },
  { slug: "moto", title: "Una moto per un giro", subtitle: "Scooter e moto", query: "cat=moto" },
] as Omit<Collection, "image">[]).map((c) => ({ ...c, image: null }));

/** "Cosa ti serve oggi?": riga compatta a scorrimento infinito (finita l'ultima idea riparte dalla prima). */
export function NeedsRow({ items }: { items: Collection[] }) {
  const list = items.length ? items : NEED_FALLBACK;
  return (
    <LoopRow auto className="-mx-4 snap-x snap-mandatory scroll-px-4 gap-3 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
      {list.map((c) => (
        <Link key={c.slug} href={`/cerca${c.query ? `?${c.query}` : ""}`} className="group w-[44%] flex-none snap-start sm:w-[30%] lg:w-[19%]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            {c.image
              ? <Image src={c.image} alt="" fill sizes="(min-width:1024px) 20vw, 45vw" className="object-cover transition duration-500 group-hover:scale-105" />
              : <div className={`absolute inset-0 bg-gradient-to-br ${isSelect(c) ? "from-navy-950 to-navy-700" : TILE_GRADIENT[c.slug] ?? "from-navy-900 to-teal-500"}`} />}
            {isSelect(c) && <SelectCorner />}
          </div>
          <p className="mt-2 text-[15px] font-semibold leading-snug">{c.title}</p>
          <p className="line-clamp-1 text-sm text-mute">{c.subtitle}</p>
        </Link>
      ))}
    </LoopRow>
  );
}
