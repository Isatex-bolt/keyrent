"use client";

import { useEffect, useState } from "react";
import { PlaceInput } from "./PlaceInput";
import { DateRange, DateOne } from "./RangePicker";
import { CategoryPicker } from "./CategoryPicker";
import { CATEGORIES } from "@/lib/catalog";

export type SearchValues = {
  luogo?: string; lat?: string; lng?: string; dal?: string; al?: string; cat?: string;
  ora_ritiro?: string; ora_riconsegna?: string; mesi?: string;
};

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
}
function addDays(n: number) { return ymd(new Date(Date.now() + n * 86_400_000)); }
/** Scorciatoie: solo giorni, gli orari li decide il noleggiatore. Oggi e Domani = un giorno. */
function shortcut(kind: "oggi" | "domani" | "weekend") {
  if (kind === "oggi") return { dal: addDays(0), al: addDays(0) };
  if (kind === "domani") return { dal: addDays(1), al: addDays(1) };
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(new Date()));
  const toSat = wd === 6 ? 0 : wd === 0 ? 6 : 6 - wd;
  return { dal: addDays(toSat), al: addDays(toSat + 1) };
}

/** Categorie del menu scorrevole in alto (stile Booking): la scelta vale per la ricerca sotto. */
export const PILLS: { key: string; label: string }[] = [
  { key: "", label: "Tutti" },
  ...CATEGORIES.map((c) => ({ key: c.slug, label: c.name })),
  { key: "lungo", label: "Lungo termine" },
];

/**
 * Ricerca della home, stile Booking: menu categorie scorrevole, riquadro compatto e ben delimitato
 * (Dove · Date · Cerca), scorciatoie sotto. La categoria scelta nel menu si applica alla ricerca.
 */
export function HomeSearch() {
  const [pill, setPill] = useState("");
  const lungo = pill === "lungo";
  const [dates, setDates] = useState<{ dal: string; al: string }>({ dal: "", al: "" });
  const [quick, setQuick] = useState<string | null>(null);
  const [today, setToday] = useState<string | undefined>(undefined);
  const [longFrom, setLongFrom] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- date di oggi solo nel browser (fuso di Roma)
  useEffect(() => { setToday(addDays(0)); setLongFrom(addDays(7)); }, []);
  const row = "flex min-h-14 items-center gap-3 px-4";
  const bare = "w-full bg-transparent py-3 text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-mute/70";

  return (
    <div>
      {/* menu scorrevole delle categorie */}
      <div role="tablist" aria-label="Cosa vuoi noleggiare" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {PILLS.map((p) => (
          <button key={p.key || "all"} type="button" role="tab" aria-selected={pill === p.key} onClick={() => setPill(p.key)}
            className={`flex-none rounded-full border px-4 py-2 text-sm font-semibold transition ${
              pill === p.key ? "border-white bg-white/15 text-white" : "border-transparent text-white/80 hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
      </div>

      <form action="/cerca" method="get">
        {pill && !lungo && <input type="hidden" name="cat" value={pill} />}
        {/* riquadro ben delimitato, una riga per campo */}
        <div className="overflow-visible rounded-2xl border-[3px] border-teal-500 bg-white shadow-xl shadow-navy-950/30 lg:flex lg:items-stretch">
          <div className={`${row} border-b border-line lg:flex-[1.4] lg:border-b-0 lg:border-r`}>
            <span className="w-20 flex-none text-xs font-semibold uppercase tracking-wide text-mute">Dove</span>
            <div className="min-w-0 flex-1"><PlaceInput id="h-luogo" className={bare} /></div>
          </div>
          {lungo ? (
            <div className={`${row} border-b border-line lg:flex-1 lg:border-b-0 lg:border-r`}>
              <input type="hidden" name="lungo" value="1" />
              <span className="w-20 flex-none text-xs font-semibold uppercase tracking-wide text-mute">Da</span>
              <div className="min-w-0 flex-1"><DateOne name="dal" placeholder="Data di inizio" title="Da quando" min={today} value={longFrom} onChange={setLongFrom} /></div>
              <select name="durata" defaultValue="36" aria-label="Durata" className="flex-none rounded-xl bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-900 outline-none">
                {[12, 24, 36, 48].map((m) => <option key={m} value={m}>{m} mesi</option>)}
              </select>
            </div>
          ) : (
            <div className={`${row} border-b border-line lg:flex-1 lg:border-b-0 lg:border-r`}>
              <span className="w-20 flex-none text-xs font-semibold uppercase tracking-wide text-mute">Quando</span>
              <div className="min-w-0 flex-1">
                <DateRange dal={dates.dal} al={dates.al} min={today} onChange={(v) => { setQuick(null); setDates(v); }} />
              </div>
            </div>
          )}
          <div className="p-2 lg:flex lg:items-center">
            <button type="submit" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-navy-900 px-8 text-base font-semibold text-white transition hover:bg-navy-800 lg:w-auto">Cerca</button>
          </div>
        </div>
      </form>

      {/* scorciatoie */}
      {!lungo && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(["oggi", "domani", "weekend"] as const).map((k) => {
            const on = quick === k;
            return (
              <button key={k} type="button" onClick={() => { setQuick(k); setDates(shortcut(k)); }} aria-pressed={on}
                className={`flex-none rounded-full px-4 py-2 text-sm font-semibold transition ${on ? "bg-teal-500 text-navy-950" : "bg-white/10 text-white hover:bg-white/20"}`}>
                {k === "oggi" ? "Oggi" : k === "domani" ? "Domani" : "Questo weekend"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Barra di ricerca compatta della pagina risultati. Su mobile si apre da un riepilogo. */
export function SearchForm({ values = {}, summary }: { values?: SearchValues; summary?: string }) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState({ dal: values.dal ?? "", al: values.al ?? "" });
  const form = (
    <form action="/cerca" method="get" className="grid gap-3 lg:grid-cols-[1.4fr_1.6fr_1fr_auto]">
      <div>
        <label htmlFor="s-luogo" className="label">Dove</label>
        <PlaceInput id="s-luogo" name={values.luogo} lat={values.lat} lng={values.lng} />
      </div>
      <div>
        <span className="label">Ritiro → Riconsegna</span>
        <div className="field flex items-center !py-0"><DateRange dal={dates.dal} al={dates.al} onChange={setDates} className="!py-2.5" /></div>
      </div>
      {values.ora_ritiro && <input type="hidden" name="ora_ritiro" value={values.ora_ritiro} />}
      {values.ora_riconsegna && <input type="hidden" name="ora_riconsegna" value={values.ora_riconsegna} />}
      <div>
        <label htmlFor="s-cat" className="label">Cosa</label>
        <CategoryPicker id="s-cat" defaultValue={values.cat ?? ""} allLabel="Tutto" />
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full">Cerca</button>
      </div>
    </form>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border-[3px] border-teal-500 bg-white px-4 py-2 text-left lg:hidden">
        <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-teal-600" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{summary || "Dove, quando, cosa"}</span>
        <span className="text-xs font-semibold text-teal-600">{open ? "Chiudi" : "Modifica"}</span>
      </button>
      <div className={`${open ? "mt-3 block" : "hidden"} lg:mt-0 lg:block`}>{form}</div>
    </>
  );
}
