import Link from "next/link";
import Image from "next/image";
import { CategoryIcon } from "./CategoryIcon";
import { euro } from "@/lib/format";
import { isHourlyCategory } from "@/lib/catalog";
import type { ResultItem } from "./ResultsView";

/**
 * Vetrina KeyRent Select in cima ai risultati normali: le foto vere dei mezzi esclusivi per la ricerca,
 * scorrevoli di lato; un tocco porta alla scheda, "Vedi tutte" alla sezione Select.
 */
export function SelectShowcase({ items, allHref }: { items: ResultItem[]; allHref: string }) {
  if (!items.length) return null;
  return (
    <section aria-label="KeyRent Select" className="mb-5 overflow-hidden rounded-2xl bg-navy-950 py-4 text-white">
      <div className="mb-3 flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">✦ KeyRent Select</p>
          <p className="truncate text-sm text-white/70">Mezzi esclusivi per la tua ricerca</p>
        </div>
        <Link href={allHref} className="flex-none text-sm font-semibold text-amber-300 hover:text-amber-200">Vedi tutte →</Link>
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4">
        {items.map((r) => (
          <Link key={r.id} href={r.href} className="group w-56 flex-none snap-start sm:w-64">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-navy-900 ring-1 ring-amber-300/30">
              {r.cover
                ? <Image src={r.cover} alt={r.title} fill sizes="260px" className="object-cover transition duration-500 group-hover:scale-105" />
                : <div className="grid h-full place-items-center text-white/30"><CategoryIcon slug={r.category_slug} className="h-12 w-12" /></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="truncate font-semibold leading-tight">{r.title}</p>
                <p className="mt-0.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-white/70">{r.city}</span>
                  <span className="flex-none font-semibold text-amber-300">
                    {r.total_cents != null ? `${euro(r.total_cents)} totale`
                      : r.price_from_cents != null ? `da ${euro(r.price_from_cents)}/${isHourlyCategory(r.category_slug) ? "ora" : "g"}` : ""}
                  </span>
                </p>
              </div>
            </div>
          </Link>
        ))}
        <Link href={allHref} className="grid w-40 flex-none snap-start place-items-center rounded-xl border border-amber-300/40 text-center text-sm font-semibold text-amber-300 hover:bg-white/5">
          <span>Vedi tutte<br />le Select →</span>
        </Link>
      </div>
    </section>
  );
}
