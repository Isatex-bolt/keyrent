"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { AttributionControl, Marker, type MapRef, type ViewStateChangeEvent } from "react-map-gl/mapbox";
import Supercluster from "supercluster";

export type MapPin = { id: string; lat: number; lng: number; label: string };
export type Bounds = [number, number, number, number]; // ovest, sud, est, nord

const ITALY: Bounds = [6.6, 36.6, 18.5, 47.1];

/** Aspetto "Mappe di iPhone": stile Standard di Mapbox, luce diurna, niente etichette di negozi e fermate che coprono i prezzi. */
const LOOK = {
  lightPreset: "day",
  theme: "default",
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  show3dObjects: true,
};

export function ResultsMap({ pins, hovered, selected, onSelect, onHover, center, bbox, onSearchArea }: {
  pins: MapPin[]; hovered: string | null; selected: string | null;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void;
  center: { lat: number; lng: number } | null; bbox: Bounds | null;
  onSearchArea: (b: Bounds) => void;
}) {
  const ref = useRef<MapRef>(null);
  const [view, setView] = useState<{ zoom: number; bounds: Bounds } | null>(null);
  const [moved, setMoved] = useState(false);

  const initial = useMemo(() => {
    if (bbox) return { bounds: bbox };
    if (pins.length > 1) {
      const lats = pins.map((p) => p.lat), lngs = pins.map((p) => p.lng);
      return { bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] as Bounds, fitBoundsOptions: { padding: 60, maxZoom: 12 } };
    }
    if (pins.length === 1) return { longitude: pins[0].lng, latitude: pins[0].lat, zoom: 11 };
    if (center) return { longitude: center.lng, latitude: center.lat, zoom: 10 };
    return { bounds: ITALY };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const index = useMemo(() => {
    const sc = new Supercluster<{ id: string; label: string }>({ radius: 56, maxZoom: 13 });
    sc.load(pins.map((p) => ({ type: "Feature", properties: { id: p.id, label: p.label }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })));
    return sc;
  }, [pins]);

  const read = useCallback(() => {
    const m = ref.current?.getMap();
    if (!m) return;
    const b = m.getBounds();
    if (!b) return;
    setView({ zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
  }, []);

  // fly-to sul mezzo selezionato dalla lista
  useEffect(() => {
    const p = pins.find((x) => x.id === selected);
    const m = ref.current?.getMap();
    if (!p || !m) return;
    const b = m.getBounds();
    if (b && !b.contains([p.lng, p.lat])) m.easeTo({ center: [p.lng, p.lat], duration: 600 });
  }, [selected, pins]);

  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMe(c); setLocating(false); setMoved(true);
        ref.current?.getMap().flyTo({ center: [c.lng, c.lat], zoom: 12, duration: 1200 });
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 300_000 },
    );
  }

  const clusters = view ? index.getClusters(view.bounds, Math.round(view.zoom)) : [];

  return (
    <div className="relative h-full w-full">
      <Map
        ref={ref}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initial}
        mapStyle="mapbox://styles/mapbox/standard"
        language="it"
        reuseMaps
        attributionControl={false}
        logoPosition="bottom-left"
        config={{ basemap: LOOK }}
        onLoad={read}
        onMoveEnd={(e: ViewStateChangeEvent) => { read(); if (e.originalEvent) setMoved(true); }}
        onClick={() => onSelect(null)}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl compact position="bottom-right" />
        {clusters.map((c) => {
          const [lng, lat] = c.geometry.coordinates;
          const props = c.properties as { cluster?: boolean; point_count?: number; cluster_id?: number; id?: string; label?: string };
          if (props.cluster) {
            return (
              <Marker key={`c${props.cluster_id}`} longitude={lng} latitude={lat}>
                <button type="button" aria-label={`${props.point_count} mezzi`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const z = Math.min(index.getClusterExpansionZoom(props.cluster_id!), 16);
                    ref.current?.getMap().easeTo({ center: [lng, lat], zoom: z, duration: 500 });
                  }}
                  className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-white bg-navy-900 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(1,25,56,0.35)] transition hover:scale-110 active:scale-95">
                  {props.point_count}
                </button>
              </Marker>
            );
          }
          const on = props.id === hovered || props.id === selected;
          return (
            <Marker key={props.id} longitude={lng} latitude={lat} style={{ zIndex: on ? 10 : 1 }}>
              <button type="button" className={`pin ${on ? "pin-on" : ""}`}
                onMouseEnter={() => onHover(props.id!)} onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onSelect(props.id!); }}>
                {props.label}
                <span aria-hidden className="pin-tail" />
              </button>
            </Marker>
          );
        })}
        {me && (
          <Marker longitude={me.lng} latitude={me.lat} style={{ zIndex: 0 }}>
            <span className="relative grid h-5 w-5 place-items-center">
              <span className="absolute h-10 w-10 animate-ping rounded-full bg-sky-500/25" />
              <span className="h-4 w-4 rounded-full border-[3px] border-white bg-sky-500 shadow-md" />
            </span>
          </Marker>
        )}
      </Map>
      {moved && (
        <button type="button"
          onClick={() => { if (view) { setMoved(false); onSearchArea(view.bounds); } }}
          className="glass absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 transition active:scale-95">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          Cerca in questa zona
        </button>
      )}

      {/* Comandi in stile iPhone: zoom e posizione */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <div className="glass flex flex-col overflow-hidden rounded-2xl">
          <button type="button" aria-label="Avvicina" onClick={() => ref.current?.getMap().zoomIn({ duration: 300 })}
            className="grid h-11 w-11 place-items-center text-navy-900 transition hover:bg-white/60 active:bg-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <span className="mx-2.5 h-px bg-navy-900/10" />
          <button type="button" aria-label="Allontana" onClick={() => ref.current?.getMap().zoomOut({ duration: 300 })}
            className="grid h-11 w-11 place-items-center text-navy-900 transition hover:bg-white/60 active:bg-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
        </div>
        <button type="button" aria-label="La mia posizione" onClick={locate}
          className={`glass grid h-11 w-11 place-items-center rounded-2xl transition active:scale-95 ${locating ? "text-teal-500" : "text-navy-900"}`}>
          <svg viewBox="0 0 24 24" className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`} fill="currentColor"><path d="M21 3L3 10.5l7.5 3 3 7.5L21 3z" /></svg>
        </button>
      </div>
    </div>
  );
}
