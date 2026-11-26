import Link from "next/link";
import Image from "next/image";
import { CategoryIcon } from "./CategoryIcon";
import { euro } from "@/lib/format";
import type { SearchResult } from "@/lib/data";

type CardData = SearchResult & { total_cents?: number | null; instant_book?: boolean; monthly_from_cents?: number | null;
  rating_avg?: number | null; rating_count?: number; premium?: boolean };

/** Scheda mezzo. `row`: su telefono foto a sinistra e dati a destra (stile Booking), da tablet in su scheda verticale. */
export function ListingCard({ r, href, active = false, row = false }: { r: CardData; href: string; active?: boolean; row?: boolean }) {
  if (row) return <RowCard r={r} href={href} active={active} />;
  return (
    <Link href={href} className={`card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg ${active ? "ring-2 ring-navy-900" : ""}`}>
      <div className="relative aspect-[4/3] bg-navy-50">
        {r.cover ? (
          <Image src={r.cover} alt={r.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-navy-700/40"><CategoryIcon slug={r.category_slug} className="h-14 w-14" /></div>
        )}
        {r.cover && r.cover_indicative && (
          <span className="absolute bottom-2 right-2 rounded-full bg-navy-950/70 px-2 py-0.5 text-[11px] font-medium text-white">
            Immagine indicativa
          </span>
        )}
        {r.available_units > 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy-900">
            {r.available_units} disponibili
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="line-clamp-1 font-semibold group-hover:text-navy-700">
          {r.title}
        </p>
        <p className="text-sm text-mute">
          {r.city} ({r.province}){r.distance_km != null ? ` · ${r.distance_km.toLocaleString("it-IT")} km` : ""}
        </p>
        <p className="pt-1 text-sm">
          {r.monthly_from_cents != null
            ? <>da <span className="text-base font-bold">{euro(r.monthly_from_cents)}</span> <span className="text-mute">/mese</span></>
            : r.total_cents != null
            ? <><span className="text-base font-bold">{euro(r.total_cents)}</span> <span className="text-mute">totale</span></>
            : r.price_from_cents != null ? <>da <span className="text-base font-bold">{euro(r.price_from_cents)}</span></> : "Prezzo su richiesta"}
        </p>
      </div>
    </Link>
  );
}

function Price({ r }: { r: CardData }) {
  if (r.monthly_from_cents != null) return <>da <span className="text-lg font-bold">{euro(r.monthly_from_cents)}</span> <span className="text-mute">/mese</span></>;
  if (r.total_cents != null) return <><span className="text-lg font-bold">{euro(r.total_cents)}</span> <span className="text-mute">totale</span></>;
  if (r.price_from_cents != null) return <>da <span className="text-lg font-bold">{euro(r.price_from_cents)}</span> <span className="text-mute">/giorno</span></>;
  return <>Prezzo su richiesta</>;
}

function RowCard({ r, href, active }: { r: CardData; href: string; active: boolean }) {
  const sub = [r.make_name, r.model_name].filter(Boolean).join(" · ");
  return (
    <Link href={href} className={`card group flex overflow-hidden transition hover:shadow-lg sm:block sm:hover:-translate-y-0.5 ${active ? "ring-2 ring-navy-900" : ""}`}>
      <div className="relative min-h-36 w-[48%] flex-none bg-navy-50 sm:aspect-[4/3] sm:min-h-0 sm:w-full">
        {r.cover ? (
          <Image src={r.cover} alt={r.title} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
        ) : (
          <div className="grid h-full min-h-32 place-items-center text-navy-700/40"><CategoryIcon slug={r.category_slug} className="h-10 w-10 sm:h-14 sm:w-14" /></div>
        )}
        {r.available_units > 1 && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-navy-900 sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">
            {r.available_units} disponibili
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 text-[13px] sm:p-4 sm:text-sm">
        <p className="line-clamp-2 font-semibold leading-snug group-hover:text-navy-700 sm:line-clamp-1">{r.title}</p>
        {sub && <p className="hidden truncate text-sm text-mute sm:block">{sub}</p>}
        <p className="flex items-center gap-1.5 text-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-mute" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          <span className="truncate">{r.city} ({r.province}){r.distance_km != null ? ` · ${r.distance_km.toLocaleString("it-IT")} km` : ""}</span>
        </p>
        {(r.premium || (r.rating_count ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(r.rating_count ?? 0) > 0 && r.rating_avg != null && (
              <span className="flex items-center gap-1.5">
                <span className="rounded-md bg-navy-900 px-1.5 py-0.5 text-xs font-bold text-white">{r.rating_avg.toLocaleString("it-IT", { minimumFractionDigits: 1 })}</span>
                <span className="text-mute">{r.rating_count} {r.rating_count === 1 ? "recensione" : "recensioni"}</span>
              </span>
            )}
            {r.premium && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">★ Premium</span>}
          </div>
        )}        <p className="mt-auto pt-1 text-right sm:text-left"><Price r={r} /></p>
      </div>
    </Link>
  );
}
