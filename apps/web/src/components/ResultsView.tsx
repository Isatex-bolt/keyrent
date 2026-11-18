"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ListingCard } from "./ListingCard";
import type { MapResult } from "@/lib/data";
import type { Bounds, MapPin } from "./ResultsMap";
import { euro } from "@/lib/format";

const ResultsMap = dynamic(() => import("./ResultsMap").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-navy-50" />,
});

export type ResultItem = MapResult & { href: string };

const SNAPS = [0.18, 0.5, 0.88]; // altezza del pannello su mobile (frazione dello schermo)

/**
 * Risultati: lista + mappa sincronizzate. Desktop: lista a sinistra, mappa fissa a destra.
 * Mobile: mappa a tutto schermo con pannello trascinabile a 3 altezze. Senza token Mapbox: solo lista.
 */
export function ResultsView({ items, top, center, bbox, hasMap }: {
  items: ResultItem[]; top: React.ReactNode;
  center: { lat: number; lng: number } | null; bbox: Bounds | null; hasMap: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [snap, setSnap] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const set = () => setVh(window.innerHeight);
    set(); window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  const pins: MapPin[] = items
    .filter((r) => r.approx_latitude != null && r.approx_longitude != null)
    .map((r) => ({
      id: r.id, lat: r.approx_latitude!, lng: r.approx_longitude!,
      label: r.total_cents != null ? euro(r.total_cents) : r.price_from_cents != null ? `da ${euro(r.price_from_cents)}` : "—",
    }));

  useEffect(() => {
    if (!selected) return;
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
              <ListingCard r={r} href={r.href} active={r.id === selected} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!hasMap) return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{list}</div>;

  const height = drag ?? SNAPS[snap] * vh;

  return (
    <div className="relative h-[calc(100dvh-8.5rem)] overflow-hidden lg:grid lg:h-auto lg:grid-cols-[minmax(0,1fr)_44%] lg:overflow-visible">
      <div className="absolute inset-0 lg:relative lg:order-2">
        <div className="h-full lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)]">
          <ResultsMap pins={pins} hovered={hovered} selected={selected} onHover={setHovered}
            onSelect={(id) => { setSelected(id); if (id && snap === 2) setSnap(1); }}
            center={center} bbox={bbox} onSearchArea={searchArea} />
          {chosen && (
            <div className="absolute inset-x-3 bottom-[calc(18dvh+0.75rem)] z-20 mx-auto max-w-sm lg:bottom-4">
              <div className="relative">
                <button type="button" aria-label="Chiudi" onClick={() => setSelected(null)}
                  className="absolute -right-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-navy-900 text-sm text-white shadow">✕</button>
                <ListingCard r={chosen} href={chosen.href} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl bg-canvas shadow-[0_-8px_30px_rgba(1,25,56,0.15)]
          lg:static lg:order-1 lg:!h-auto lg:rounded-none lg:shadow-none ${drag == null ? "transition-[height] duration-300 ease-out" : ""}`}
        style={{ height }}
      >
        <div
          className="flex flex-none cursor-grab touch-none justify-center py-3 lg:hidden"
          onPointerDown={(e) => { start.current = { y: e.clientY, h: height }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            if (!start.current) return;
            setDrag(Math.min(Math.max(start.current.h + (start.current.y - e.clientY), SNAPS[0] * vh), SNAPS[2] * vh));
          }}
          onPointerUp={() => {
            if (start.current && drag != null) {
              const frac = drag / vh;
              const nearest = SNAPS.reduce((best, s, i) => (Math.abs(s - frac) < Math.abs(SNAPS[best] - frac) ? i : best), 0);
              setSnap(nearest);
            } else if (start.current) {
              setSnap((s) => (s + 1) % SNAPS.length);
            }
            start.current = null; setDrag(null);
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-navy-900/20" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6 lg:overflow-visible lg:py-6">{list}</div>
      </div>
    </div>
  );
}
