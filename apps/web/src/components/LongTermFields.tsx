"use client";

import { useEffect, useRef, useState } from "react";
import { LT_DURATIONS, LT_KM, LT_SERVICES, ratesFor, type LongTermData } from "@/lib/longTerm";

const eur = (c?: number) => (c ? String(c / 100) : "");

/**
 * "Come lo noleggi?": breve termine, lungo termine o entrambi.
 * Con il lungo termine il noleggiatore sceglie le fasce di km all'anno e, per ognuna, la rata mensile per durata
 * (almeno una rata obbligatoria). I servizi hanno sì/no + prezzo al mese.
 */
export function LongTermFields({ initial, onModeChange }: { initial?: Partial<LongTermData>; onModeChange?: (m: { short: boolean; long: boolean }) => void }) {
  const [short, setShort] = useState(initial?.short_term_enabled ?? true);
  const [long, setLong] = useState(initial?.long_term_enabled ?? false);
  const baseKm = initial?.lt_km_per_year ?? null;
  // rate già salvate, chiave "mesi_km"
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of LT_DURATIONS) for (const [k, v] of Object.entries(ratesFor(initial?.lt_prices, m, baseKm))) out[`${m}_${k}`] = eur(v);
    return out;
  });
  const [kms, setKms] = useState<number[]>(() => {
    const used = LT_KM.filter((k) => LT_DURATIONS.some((m) => prices[`${m}_${k}`]));
    return used.length ? used : [15000];
  });
  const [srv, setSrv] = useState<Record<string, boolean>>(() => Object.fromEntries(LT_SERVICES.map((x) => [x.key, !!initial?.lt_services?.[x.key]?.offered])));
  const first = useRef<HTMLInputElement>(null);
  const anyPrice = Object.entries(prices).some(([k, v]) => kms.includes(Number(k.split("_")[1])) && Number(v.replace(",", ".")) > 0);

  useEffect(() => { onModeChange?.({ short, long }); }, [short, long, onModeChange]);
  // almeno una rata: il controllo del modulo guidato blocca il passo finché manca
  useEffect(() => { first.current?.setCustomValidity(long && !anyPrice ? "Indica la rata mensile per almeno una durata e una fascia di km." : ""); }, [long, anyPrice]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Come lo noleggi?</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([["short", "Breve termine", "Giorni e settimane, con prenotazione", short, setShort], ["long", "Lungo termine", "12–48 mesi, rata mensile", long, setLong]] as const).map(([k, title, sub, on, set]) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${on ? "border-navy-900 bg-navy-50 ring-1 ring-navy-900" : "border-line"}`}>
              <input type="checkbox" name={k === "short" ? "mode_short" : "mode_long"} value="1" checked={on}
                onChange={(e) => { const v = e.target.checked; if (!v && !(k === "short" ? long : short)) return; set(v); }} className="mt-1 h-5 w-5 accent-teal-600" />
              <span><span className="block font-semibold">{title}</span><span className="text-sm text-mute">{sub}</span></span>
            </label>
          ))}
        </div>
      </div>

      {long && (
        <div className="space-y-4 rounded-2xl border border-line p-4">
          <div>
            <p className="font-semibold">Km all&apos;anno che offri</p>
            <p className="text-sm text-mute">Scegli una o più fasce: per ognuna indichi la rata. Il cliente sceglie i km e la rata cambia.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LT_KM.map((k) => {
                const on = kms.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => setKms((v) => on ? (v.length > 1 ? v.filter((x) => x !== k) : v) : [...v, k].sort((a, b) => a - b))}
                    className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${on ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-ink"}`}>
                    {k.toLocaleString("it-IT")} km
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="font-semibold">Rata mensile (€/mese, IVA inclusa)</p>
            <p className="text-sm text-mute">Lascia vuote le combinazioni che non offri. Serve almeno una rata.</p>
            <div className="mt-3 space-y-3">
              {kms.map((k, ki) => (
                <div key={k} className="rounded-2xl bg-navy-50/60 p-3">
                  <p className="mb-2 text-sm font-semibold">{k.toLocaleString("it-IT")} km all&apos;anno</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {LT_DURATIONS.map((m, i) => {
                      const key = `${m}_${k}`;
                      return (
                        <div key={key}><label className="mb-1 block text-xs font-medium text-mute" htmlFor={`lt_price_${key}`}>{m} mesi</label>
                          <input ref={ki === 0 && i === 0 ? first : undefined} id={`lt_price_${key}`} name={`lt_price_${key}`} type="number" inputMode="decimal" min={0} step="0.01"
                            value={prices[key] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [key]: e.target.value }))} className="field bg-white" placeholder="—" /></div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="sm:w-1/2">
            <label className="label" htmlFor="lt_extra_km">Km in più oltre la fascia (€/km)</label>
            <input id="lt_extra_km" name="lt_extra_km" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={eur(initial?.lt_extra_km_cents ?? undefined)} className="field" placeholder="Es. 0,12" />
          </div>
          <div>
            <p className="font-semibold">Servizi che il cliente può aggiungere</p>
            <p className="text-sm text-mute">Spunta quelli che offri e indica il prezzo al mese. Prezzo 0 = incluso nella rata.</p>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
              {LT_SERVICES.map((x) => (
                <li key={x.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" name={`lt_srv_${x.key}`} value="1" checked={srv[x.key]} onChange={(e) => setSrv((v) => ({ ...v, [x.key]: e.target.checked }))} className="h-5 w-5 accent-teal-600" />
                    <span className="font-medium">{x.label}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input aria-label={`Prezzo al mese ${x.label}`} name={`lt_srv_${x.key}_price`} type="number" inputMode="decimal" min={0} step="0.01" disabled={!srv[x.key]}
                      defaultValue={eur(initial?.lt_services?.[x.key]?.cents)} className="field w-28 disabled:opacity-40" placeholder="0" />
                    <span className="text-sm text-mute">€/mese</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
