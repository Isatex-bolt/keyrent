"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PLACES } from "@/lib/places";
import { slugify } from "@/lib/format";

type Suggestion =
  | { kind: "me"; label: string }
  | { kind: "local"; label: string; sub: string; lat: number; lng: number }
  | { kind: "mapbox"; label: string; sub: string; id: string };

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const API = "https://api.mapbox.com/search/searchbox/v1";

/**
 * Campo "Dove" con suggerimenti: città principali (sempre disponibili) + Mapbox Search Box
 * (indirizzi, aeroporti, stazioni, luoghi) se il token è configurato. Scrive nei campi nascosti
 * luogo/lat/lng, così il form resta un normale GET e funziona anche senza JavaScript.
 */
export function PlaceInput({ name, lat, lng, id, className = "field" }: {
  name?: string; lat?: string; lng?: string; id?: string; className?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState(name ?? "");
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(lat && lng ? { lat, lng } : null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const session = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function local(text: string): Suggestion[] {
    const s = slugify(text);
    if (!s) return PLACES.filter((p) => ["roma", "milano", "firenze", "venezia", "napoli", "bologna"].includes(p.slug))
      .map((p) => ({ kind: "local", label: p.name, sub: `Città · ${p.province}`, lat: p.lat, lng: p.lng }));
    return PLACES.filter((p) => p.slug.startsWith(s) || p.slug.includes(`-${s}`)).slice(0, 4)
      .map((p) => ({ kind: "local", label: p.name, sub: `Città · ${p.province}`, lat: p.lat, lng: p.lng }));
  }

  function search(text: string) {
    const base: Suggestion[] = [{ kind: "me", label: "Vicino a me" }, ...local(text)];
    setItems(base); setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (!TOKEN || text.trim().length < 3) return;
    timer.current = setTimeout(async () => {
      session.current ||= crypto.randomUUID();
      const url = `${API}/suggest?q=${encodeURIComponent(text)}&language=it&country=IT&limit=6`
        + `&types=place,locality,neighborhood,address,poi&session_token=${session.current}&access_token=${TOKEN}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: { name: string; mapbox_id: string; place_formatted?: string; full_address?: string }[] };
        const seen = new Set(base.map((b) => slugify(b.label)));
        const extra: Suggestion[] = data.suggestions
          .filter((s) => !seen.has(slugify(s.name)))
          .map((s) => ({ kind: "mapbox", label: s.name, sub: s.place_formatted ?? s.full_address ?? "", id: s.mapbox_id }));
        setItems([...base, ...extra]);
      } catch { /* rete assente: restano le città locali */ }
    }, 220);
  }

  async function choose(s: Suggestion) {
    setOpen(false);
    if (s.kind === "local") { setQ(s.label); setCoords({ lat: String(s.lat), lng: String(s.lng) }); return; }
    if (s.kind === "me") {
      if (!navigator.geolocation) return;
      setBusy(true);
      navigator.geolocation.getCurrentPosition(
        (p) => { setQ("Vicino a me"); setCoords({ lat: p.coords.latitude.toFixed(4), lng: p.coords.longitude.toFixed(4) }); setBusy(false); },
        () => { setBusy(false); alertLater("Non riusciamo a leggere la tua posizione: scrivi una città."); },
        { timeout: 8000, maximumAge: 600_000 },
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/retrieve/${encodeURIComponent(s.id)}?session_token=${session.current}&access_token=${TOKEN}`);
      const data = (await res.json()) as { features?: { geometry: { coordinates: [number, number] } }[] };
      const c = data.features?.[0]?.geometry.coordinates;
      setQ(s.label);
      setCoords(c ? { lat: c[1].toFixed(5), lng: c[0].toFixed(5) } : null);
    } catch { setQ(s.label); setCoords(null); }
    session.current = "";
    setBusy(false);
  }

  const [hint, setHint] = useState<string | null>(null);
  function alertLater(t: string) { setHint(t); setTimeout(() => setHint(null), 5000); }

  return (
    <div ref={box} className="relative">
      <input
        id={id} name="luogo" value={q} autoComplete="off" placeholder="Città, indirizzo, aeroporto…"
        className={className} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        onFocus={() => { search(q === "Vicino a me" ? "" : q); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setCoords(null); search(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {coords && <><input type="hidden" name="lat" value={coords.lat} /><input type="hidden" name="lng" value={coords.lng} /></>}
      {busy && <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />}
      {hint && <p className="mt-1 text-xs text-red-600">{hint}</p>}
      {open && items.length > 0 && (
        <ul id={listId} role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-2xl border border-line bg-white p-1.5 text-left shadow-xl">
          {items.map((s, i) => (
            <li key={`${s.kind}-${s.label}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? "bg-navy-50" : "hover:bg-navy-50"}`}>
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-full ${s.kind === "me" ? "bg-teal-50 text-teal-600" : "bg-navy-50 text-navy-700"}`}>
                  {s.kind === "me" ? <Crosshair /> : <Pin />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{s.label}</span>
                  {s.kind !== "me" && s.sub && <span className="block truncate text-xs text-mute">{s.sub}</span>}
                  {s.kind === "me" && <span className="block text-xs text-mute">Usa la tua posizione attuale</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Pin = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
const Crosshair = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
);
