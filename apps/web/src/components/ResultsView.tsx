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

const PEEK = 0.55; // su telefono l'elenco parte dal 55% della mappa; scorrendo la pagina sale e copre la mappa

/**
 * Risultati: lista + mappa sincronizzate. Desktop: lista a sinistra, mappa fissa a destra.
 * Telefono: mappa ferma dietro, l'elenco scorre con la pagina e sale sopra la mappa (un solo gesto, una mano).
 * Tornando in cima ricompare la mappa. Finiti i mezzi la pagina si ferma: sotto l'ultimo non si vede la mappa
 * (overflow-clip: la mappa resta dentro il riquadro dei risultati, senza rompere lo sticky). Pulsante "Apri mappa" fisso in alto quando l'elenco la copre.
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
  const boxRef = useRef<HTMLDivElement>(null);
  // altezza occupata da header + barra di ricerca (fissi in alto su telefono): la mappa parte sotto di loro
  const [top0, setTop0] = useState(136);
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setTop0(Math.round(el.getBoundingClientRect().top + window.scrollY));
    measure();
    const mapEl = el.firstElementChild as HTMLElement | null;
    const onScroll = () => {
      const mapH = mapEl?.offsetHeight ?? window.innerHeight - top0 - 64;
      setCovered(window.scrollY > mapH * PEEK + 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // solo cambi di larghezza (rotazione): l'altezza cambia di continuo con la barra di Safari e farebbe saltare la pagina
    let w = window.innerWidth;
    const onResize = () => { if (window.innerWidth !== w) { w = window.innerWidth; measure(); } };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, [top0]);

  const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  function showMap() { window.scrollTo({ top: 0, behavior: "smooth" }); }

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
    <div ref={boxRef} data-results-map style={{ "--top": `${top0}px` } as React.CSSProperties}
      className="relative max-lg:overflow-clip [--maph:calc(100svh-var(--top)-64px-env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[minmax(0,1fr)_44%]">
      {/* mappa: ferma dietro l'elenco su telefono, colonna fissa a destra su computer */}
      <div className="sticky top-[var(--top)] z-0 mb-[calc(var(--maph)*-1)] h-[var(--maph)] lg:top-16 lg:order-2 lg:mb-0 lg:h-[calc(100svh-4rem)]">
        <ResultsMap pins={pins} hovered={hovered} selected={selected} onHover={setHovered}
          onSelect={(id) => { setSelected(id); if (id && !isDesktop()) showMap(); }}
          center={center} bbox={bbox} onSearchArea={searchArea} />
        {chosen && (
          <div className={`absolute inset-x-3 z-20 mx-auto max-w-md bottom-[calc(45%+0.75rem)] lg:bottom-4`}>
            <MiniCard r={chosen} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {/* elenco: su telefono parte sotto la mappa e sale scorrendo la pagina */}
      <div className="relative z-10 mt-[calc(var(--maph)*0.55)] rounded-t-3xl bg-canvas shadow-[0_-8px_30px_rgba(1,25,56,0.15)]
        lg:order-1 lg:mt-0 lg:min-h-0 lg:rounded-none lg:shadow-none">
        <button type="button" aria-label="Scorri l'elenco" onClick={() => window.scrollTo({ top: ((boxRef.current?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0) * PEEK, behavior: "smooth" })}
          className="flex w-full justify-center py-3 lg:hidden">
          <span className="h-1.5 w-10 rounded-full bg-navy-900/20" />
        </button>
        <div className="px-4 pb-8 sm:px-6 lg:py-6">{list}</div>
      </div>

      {/* telefono: "Apri mappa" fisso in alto quando l'elenco copre la mappa */}
      <button type="button" onClick={showMap} aria-hidden={!covered} tabIndex={covered ? 0 : -1}
        className={`fixed left-1/2 top-[calc(var(--top)+0.75rem)] z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition lg:hidden ${
          covered ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>
        Apri mappa
      </button>
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
