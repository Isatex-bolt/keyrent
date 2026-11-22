"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PROVINCE, provinceCode } from "@/lib/province";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const API = "https://api.mapbox.com/search/searchbox/v1";
type Sug = { id: string; name: string; sub: string };
type Ctx = { name?: string; region_code?: string };

/**
 * Indirizzo della sede: si scrive via e città, si sceglie dai suggerimenti (tutta Italia)
 * e si compilano da soli CAP, città, provincia e posizione sulla mappa. I campi restano modificabili.
 */
type Initial = { address_line?: string; postal_code?: string; city?: string; province?: string; lat?: number; lng?: number };

export function AddressFields({ initial }: { initial?: Initial }) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [f, setF] = useState({
    address_line: initial?.address_line ?? "", postal_code: initial?.postal_code ?? "", city: initial?.city ?? "", province: initial?.province ?? "",
  });
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(
    initial?.lat && initial?.lng ? { lat: String(initial.lat), lng: String(initial.lng) } : null);
  const [items, setItems] = useState<Sug[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const session = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value })); if (k !== "province") setCoords(null);
  };

  useEffect(() => {
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function search(text: string) {
    if (timer.current) clearTimeout(timer.current);
    if (!TOKEN || text.trim().length < 3) { setItems([]); return; }
    timer.current = setTimeout(async () => {
      session.current ||= crypto.randomUUID();
      try {
        const res = await fetch(`${API}/suggest?q=${encodeURIComponent(text)}&language=it&country=IT&limit=6`
          + `&types=address,street,poi,place&session_token=${session.current}&access_token=${TOKEN}`);
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: { name: string; mapbox_id: string; place_formatted?: string; full_address?: string }[] };
        setItems(data.suggestions.map((s) => ({ id: s.mapbox_id, name: s.name, sub: s.place_formatted ?? s.full_address ?? "" })));
        setOpen(true);
      } catch { /* senza rete si compilano i campi a mano */ }
    }, 220);
  }

  async function choose(s: Sug) {
    setOpen(false); setBusy(true);
    try {
      const res = await fetch(`${API}/retrieve/${encodeURIComponent(s.id)}?session_token=${session.current}&access_token=${TOKEN}`);
      const data = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: {
        name?: string; address?: string; context?: Record<string, Ctx> } }[] };
      const ft = data.features?.[0];
      const c = ft?.properties.context ?? {};
      const street = c.address?.name ?? ft?.properties.address ?? (c.street?.name ?? ft?.properties.name ?? s.name);
      setF({
        address_line: street,
        postal_code: c.postcode?.name ?? "",
        city: c.place?.name ?? c.locality?.name ?? "",
        province: provinceCode(c.district?.name) || provinceCode(c.region?.name) || "",
      });
      const g = ft?.geometry.coordinates;
      setCoords(g ? { lat: g[1].toFixed(6), lng: g[0].toFixed(6) } : null);
      setQ(`${s.name}${s.sub ? `, ${s.sub}` : ""}`);
    } catch { /* restano i campi a mano */ }
    session.current = "";
    setBusy(false);
  }

  return (
    <>
      <div ref={box} className="relative sm:col-span-2">
        <label className="label" htmlFor="cerca_indirizzo">Cerca l&apos;indirizzo</label>
        <input id="cerca_indirizzo" value={q} autoComplete="off" placeholder="Es. Via Vittorio Veneto 95, Tombolo"
          className="field" role="combobox" aria-expanded={open} aria-controls={listId}
          onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
        {busy && <span className="absolute right-3 top-[2.6rem] h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />}
        {open && items.length > 0 && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl">
            {items.map((s) => (
              <li key={s.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}
                  className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-navy-50">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block truncate text-xs text-mute">{s.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-mute">Scegli dai suggerimenti: CAP, città e provincia si compilano da soli. Puoi correggerli qui sotto.</p>
      </div>
      <div className="sm:col-span-2"><label className="label" htmlFor="address_line">Indirizzo (via e numero)</label>
        <input id="address_line" name="address_line" required value={f.address_line} onChange={set("address_line")} className="field" /></div>
      <div><label className="label" htmlFor="city">Città</label>
        <input id="city" name="city" required value={f.city} onChange={set("city")} className="field" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="postal_code">CAP</label>
          <input id="postal_code" name="postal_code" required inputMode="numeric" maxLength={5} value={f.postal_code} onChange={set("postal_code")} className="field" /></div>
        <div><label className="label" htmlFor="province">Provincia</label>
          <select id="province" name="province" required value={f.province} onChange={set("province")} className="field">
            <option value="" disabled>—</option>
            {Object.entries(PROVINCE).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
          </select></div>
      </div>
      {coords && <><input type="hidden" name="lat" value={coords.lat} /><input type="hidden" name="lng" value={coords.lng} /></>}
    </>
  );
}
