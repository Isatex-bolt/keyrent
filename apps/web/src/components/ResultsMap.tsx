"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { AttributionControl, Marker, NavigationControl, type MapRef, type ViewStateChangeEvent } from "react-map-gl/mapbox";
import Supercluster from "supercluster";

export type MapPin = { id: string; lat: number; lng: number; label: string };
export type Bounds = [number, number, number, number]; // ovest, sud, est, nord

const ITALY: Bounds = [6.6, 36.6, 18.5, 47.1];

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

  const clusters = view ? index.getClusters(view.bounds, Math.round(view.zoom)) : [];

  return (
    <div className="relative h-full w-full">
      <Map
        ref={ref}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initial}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        language="it"
        reuseMaps
        attributionControl={false}
        onLoad={read}
        onMoveEnd={(e: ViewStateChangeEvent) => { read(); if (e.originalEvent) setMoved(true); }}
        onClick={() => onSelect(null)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <AttributionControl compact position="bottom-left" />
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
                  className="grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-teal-500 text-sm font-bold text-navy-950 shadow-lg transition hover:scale-110">
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
              </button>
            </Marker>
          );
        })}
      </Map>
      {moved && (
        <button type="button"
          onClick={() => { if (view) { setMoved(false); onSearchArea(view.bounds); } }}
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-navy-800">
          Cerca in questa zona
        </button>
      )}
    </div>
  );
}
