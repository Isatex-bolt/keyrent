"use client";

import { useState } from "react";

/** Consegna a domicilio del mezzo: spunta + raggio + prezzo fisso + prezzo al km (con esempio di calcolo). */
export function DeliveryFields({ initial }: { initial?: { enabled: boolean; radius: number | null; fee: number; perKm: number } }) {
  const [on, setOn] = useState(initial?.enabled ?? false);
  const [fee, setFee] = useState(initial ? String(initial.fee / 100 || "") : "");
  const [perKm, setPerKm] = useState(initial ? String(initial.perKm / 100 || "") : "");
  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const example = n(fee) + n(perKm) * 12;
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="delivery_enabled" value="1" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1 h-5 w-5 accent-teal-600" />
        <span>
          <span className="block font-semibold">Consegno il mezzo a domicilio</span>
          <span className="text-sm text-mute">Il cliente vedrà &quot;Consegnamelo&quot; e il prezzo calcolato in base alla distanza dalla sede.</span>
        </span>
      </label>
      {on && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="delivery_radius_km">Raggio massimo (km)</label>
            <input id="delivery_radius_km" name="delivery_radius_km" type="number" inputMode="numeric" min={1} max={500} required defaultValue={initial?.radius ?? ""} className="field" placeholder="Es. 30" /></div>
          <div><label className="label" htmlFor="delivery_fee">Prezzo fisso (€)</label>
            <input id="delivery_fee" name="delivery_fee" type="number" inputMode="decimal" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="field" placeholder="Es. 10" /></div>
          <div><label className="label" htmlFor="delivery_per_km">Prezzo al km (€)</label>
            <input id="delivery_per_km" name="delivery_per_km" type="number" inputMode="decimal" min={0} step="0.01" value={perKm} onChange={(e) => setPerKm(e.target.value)} className="field" placeholder="Es. 0,80" /></div>
          <p className="text-xs text-mute sm:col-span-3">
            Esempio: cliente a 12 km dalla sede → consegna {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(example)}. Oltre il raggio la consegna non si può scegliere.
          </p>
        </div>
      )}
    </div>
  );
}
