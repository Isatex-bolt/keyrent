"use client";

import { useEffect, useState } from "react";
import { PlaceInput } from "@/components/PlaceInput";
import { CATEGORIES } from "@/lib/catalog";

/** Ricerca rapida: Dove, Quando, Cosa. Porta alla ricerca vera (/cerca). */
export function QuickSearch({ steps = false }: { steps?: boolean }) {
  const [step, setStep] = useState(0);
  const [dal, setDal] = useState(""); const [al, setAl] = useState(""); const [cat, setCat] = useState("");
  const [today, setToday] = useState("");
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)); }, []);
  const show = (n: number) => !steps || step === n;
  const date = "field text-base";
  return (
    <form action="/cerca" method="get" className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
      {steps && (
        <div className="flex gap-1.5">{["Dove", "Quando", "Cosa"].map((s, i) => (
          <button type="button" key={s} onClick={() => setStep(i)} className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${step === i ? "bg-navy-900 text-white" : "bg-navy-50 text-mute"}`}>{i + 1}. {s}</button>
        ))}</div>
      )}
      <div className={show(0) ? "" : "hidden"}>
        <label className="label">Dove</label>
        <PlaceInput className="field text-base" />
      </div>
      <div className={show(1) ? "" : "hidden"}>
        <label className="label">Quando</label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="dal" aria-label="Ritiro" value={dal} min={today} onChange={(e) => { setDal(e.target.value); if (!al || al < e.target.value) setAl(e.target.value); }} className={date} />
          <input type="date" name="al" aria-label="Riconsegna" value={al} min={dal || today} onChange={(e) => setAl(e.target.value)} className={date} />
        </div>
      </div>
      <div className={show(2) ? "" : "hidden"}>
        <label className="label">Cosa</label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ slug: "", name: "Tutto" }, ...CATEGORIES].map((c) => (
            <button type="button" key={c.slug} onClick={() => setCat(c.slug)}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition ${cat === c.slug ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{c.name}</button>
          ))}
        </div>
        <input type="hidden" name="cat" value={cat} />
      </div>
      {steps && step < 2
        ? <button type="button" onClick={() => setStep(step + 1)} className="btn-primary w-full py-4 text-base">Avanti</button>
        : <button className="btn-primary w-full py-4 text-base">Mostra risultati</button>}
    </form>
  );
}
