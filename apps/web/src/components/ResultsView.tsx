"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ListingCard } from "./ListingCard";
import type { MapResult } from "@/lib/data";
import type { Bounds, MapPin } from "./ResultsMap";
import { euro } from "@/lib/format";
import Link from "next/link";
import Image from "next/image";
import { CategoryIcon } from "./CategoryIcon";

const ResultsMap = dynamic(() => import("./ResultsMap").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-navy-50" />,
});

export type ResultItem = MapResult & { href: string; monthly_from_cents?: number | null; rating_avg?: number | null; rating_count?: number; premium?: boolean; is_select?: boolean };


/**
 * Risultati. Computer: lista a sinistra, mappa fissa a destra (sincronizzate).
 * Telefono: solo l'elenco, subito; la zona di ogni mezzo si vede nella sua scheda (ListingMap).
 * Senza token Mapbox: solo lista.
 */
export function ResultsView({ items, top, center, bbox, hasMap }: {
  items: ResultItem[]; top: React.ReactNode;
  center: { lat: number; lng: number } | null; bbox: Bounds | null; hasMap: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // la mappa c'è solo da computer: su telefono si vedono subito gli annunci (la zona è nella scheda di ogni mezzo)
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  const pins: MapPin[] = items
    .filter((r) => r.approx_latitude != null && r.approx_longitude != null)
    .map((r) => ({
      id: r.id, lat: r.approx_latitude!, lng: r.approx_longitude!,
      label: r.monthly_from_cents != null ? `${euro(r.monthly_from_cents)}/mese` : r.total_cents != null ? euro(r.total_cents) : r.price_from_cents != null ? `da ${euro(r.price_from_cents)}` : "—",
    }));

  useEffect(() => {
    if (!selected || !isDesktop()) return;
    listRef.current?.querySelector(`[data-id="${selected}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  function searchArea(b: Bounds) {
    const q = new URLSearchParams(params.toString());
    for (const k of ["luogo", "lat", "lng", "pagina"]) q.delete(k);
    q.set("zona", b.map((n) => n.toFixed(4)).join(","));
    router.push(`/cerca?${q.toString()}`, { scroll: false });
  }

  const chosen = items.find((r) => r.id === selected);

  const list = (
    <div ref={listRef}>
      {top}
      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((r) => (
            <div key={r.id} data-id={r.id} onMouseEnter={() => setHovered(r.id)} onMouseLeave={() => setHovered(null)}>
              <ListingCard r={r} href={r.href} active={r.id === selected} row />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!hasMap) return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{list}</div>;

  return (
    <div data-results-map className="lg:grid lg:grid-cols-[minmax(0,1fr)_44%]">
      {desk && (
        <div className="sticky top-16 z-0 order-2 h-[calc(100svh-4rem)]">
          <ResultsMap pins={pins} hovered={hovered} selected={selected} onHover={setHovered} onSelect={setSelected}
            center={center} bbox={bbox} onSearchArea={searchArea} />
          {chosen && (
            <div className="absolute inset-x-3 bottom-4 z-20 mx-auto max-w-md">
              <MiniCard r={chosen} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      )}
      <div className="lg:order-1 lg:min-h-0">
        <div className="px-4 pb-8 pt-4 sm:px-6 lg:py-6">{list}</div>
      </div>
    </div>
  );
}

/** Scheda compatta del mezzo scelto sulla mappa: foto piccola a sinistra, dati a destra. */
function MiniCard({ r, onClose }: { r: ResultItem; onClose: () => void }) {
  return (
    <div className="relative animate-[kr-rise_.2s_ease-out_both]">
      <Link href={r.href} className="flex overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_30px_rgba(1,25,56,0.2)]">
        <div className="relative h-28 w-28 flex-none bg-navy-50">
          {r.cover
            ? <Image src={r.cover} alt="" fill sizes="112px" className="object-cover" />
            : <div className="grid h-full place-items-center text-navy-700/40"><CategoryIcon slug={r.category_slug} className="h-9 w-9" /></div>}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 p-3 pr-9">
          <p className="line-clamp-2 font-semibold leading-snug">{r.title}</p>
          <p className="truncate text-sm text-mute">{r.city} ({r.province}){r.distance_km != null ? ` · ${r.distance_km.toLocaleString("it-IT")} km` : ""}</p>
          <p className="pt-1 text-sm">
            {r.monthly_from_cents != null ? <>da <span className="text-base font-bold">{euro(r.monthly_from_cents)}</span> <span className="text-mute">/mese</span></> : r.total_cents != null
              ? <><span className="text-base font-bold">{euro(r.total_cents)}</span> <span className="text-mute">totale</span></>
              : r.price_from_cents != null ? <>da <span className="text-base font-bold">{euro(r.price_from_cents)}</span></> : "Prezzo su richiesta"}
          </p>
        </div>
      </Link>
      <button type="button" aria-label="Chiudi" onClick={onClose}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-navy-50 text-sm text-navy-900">✕</button>
    </div>
  );
}
