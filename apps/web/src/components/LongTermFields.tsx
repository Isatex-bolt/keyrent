"use client";

import { useEffect, useRef, useState } from "react";
import { LT_DURATIONS, LT_SERVICES, type LongTermData } from "@/lib/longTerm";

const eur = (c?: number) => (c ? String(c / 100) : "");

/**
 * "Come lo noleggi?": breve termine, lungo termine o entrambi.
 * Con il lungo termine diventano obbligatori rata mensile (almeno una durata) e km annui; i servizi hanno sì/no + prezzo al mese.
 */
export function LongTermFields({ initial, onModeChange }: { initial?: Partial<LongTermData>; onModeChange?: (m: { short: boolean; long: boolean }) => void }) {
  const [short, setShort] = useState(initial?.short_term_enabled ?? true);
  const [long, setLong] = useState(initial?.long_term_enabled ?? false);
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(LT_DURATIONS.map((m) => [m, eur(initial?.lt_prices?.[String(m)])])));
  const [srv, setSrv] = useState<Record<string, boolean>>(() => Object.fromEntries(LT_SERVICES.map((x) => [x.key, !!initial?.lt_services?.[x.key]?.offered])));
  const first = useRef<HTMLInputElement>(null);
  const anyPrice = Object.values(prices).some((v) => Number(v.replace(",", ".")) > 0);

  useEffect(() => { onModeChange?.({ short, long }); }, [short, long, onModeChange]);
  // almeno una rata: il controllo del modulo guidato blocca il passo finché manca
  useEffect(() => { first.current?.setCustomValidity(long && !anyPrice ? "Indica la rata mensile per almeno una durata." : ""); }, [long, anyPrice]);

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
            <p className="font-semibold">Rata mensile per durata</p>
            <p className="text-sm text-mute">IVA inclusa. Compila almeno una durata: lascia vuote quelle che non offri.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LT_DURATIONS.map((m, i) => (
                <div key={m}><label className="label" htmlFor={`lt_price_${m}`}>{m} mesi (€/mese)</label>
                  <input ref={i === 0 ? first : undefined} id={`lt_price_${m}`} name={`lt_price_${m}`} type="number" inputMode="decimal" min={0} step="0.01"
                    value={prices[m]} onChange={(e) => setPrices((p) => ({ ...p, [m]: e.target.value }))} className="field" placeholder="—" /></div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="lt_km_per_year">Km all&apos;anno inclusi</label>
              <input id="lt_km_per_year" name="lt_km_per_year" type="number" inputMode="numeric" min={1000} step={1000} required defaultValue={initial?.lt_km_per_year ?? ""} className="field" placeholder="Es. 15000" /></div>
            <div><label className="label" htmlFor="lt_extra_km">Km in più (€/km)</label>
              <input id="lt_extra_km" name="lt_extra_km" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={eur(initial?.lt_extra_km_cents ?? undefined)} className="field" placeholder="Es. 0,12" /></div>
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
