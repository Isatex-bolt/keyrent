"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/catalog";
import { CategoryIcon } from "./CategoryIcon";
import { PlaceInput } from "./PlaceInput";

export type SearchValues = {
  luogo?: string; lat?: string; lng?: string; dal?: string; al?: string; cat?: string;
  ora_ritiro?: string; ora_riconsegna?: string; mesi?: string;
};

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
}
function addDays(n: number) { return ymd(new Date(Date.now() + n * 86_400_000)); }
function shortcut(kind: "oggi" | "domani" | "weekend") {
  if (kind === "oggi") {
    const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    const start = Math.min(Math.max(h + 1, 8), 20);
    return { dal: addDays(0), al: addDays(1), ora_ritiro: `${String(start).padStart(2, "0")}:00`, ora_riconsegna: "10:00" };
  }
  if (kind === "domani") return { dal: addDays(1), al: addDays(2), ora_ritiro: "10:00", ora_riconsegna: "10:00" };
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(new Date()));
  const toSat = wd === 6 ? 0 : wd === 0 ? 6 : 6 - wd;
  return { dal: addDays(toSat), al: addDays(toSat + 1), ora_ritiro: "09:00", ora_riconsegna: "19:00" };
}

/** Ricerca della home: Prenota | Lungo termine, Dove con suggerimenti, Quando con scorciatoie, Cosa a chip. */
export function HomeSearch() {
  const [mode, setMode] = useState<"breve" | "lungo">("breve");
  const [dates, setDates] = useState<{ dal: string; al: string; ora_ritiro: string; ora_riconsegna: string }>(
    { dal: "", al: "", ora_ritiro: "10:00", ora_riconsegna: "10:00" });
  const [quick, setQuick] = useState<string | null>(null);
  const [cat, setCat] = useState("");
  const [today, setToday] = useState<string | undefined>(undefined);
  const [longFrom, setLongFrom] = useState("");
  useEffect(() => { setToday(addDays(0)); setLongFrom(addDays(7)); }, []);

  return (
    <div>
      <div role="tablist" className="mb-4 inline-flex rounded-full bg-navy-50 p-1 text-sm font-semibold">
        {([["breve", "Prenota"], ["lungo", "Lungo termine"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`rounded-full px-4 py-2 transition ${mode === k ? "bg-white text-navy-900 shadow-sm" : "text-mute hover:text-navy-900"}`}>
            {l}
          </button>
        ))}
      </div>

      <form action="/cerca" method="get" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <label htmlFor="h-luogo" className="label">Dove</label>
            <PlaceInput id="h-luogo" />
          </div>
          {mode === "breve" ? (
            <>
              <div>
                <label htmlFor="h-dal" className="label">Ritiro</label>
                <input id="h-dal" name="dal" type="date" min={today} className="field" value={dates.dal}
                  onChange={(e) => { setQuick(null); setDates((d) => ({ ...d, dal: e.target.value, al: d.al && d.al > e.target.value ? d.al : "" })); }} />
              </div>
              <div>
                <label htmlFor="h-al" className="label">Riconsegna</label>
                <input id="h-al" name="al" type="date" min={dates.dal || today} className="field" value={dates.al}
                  onChange={(e) => { setQuick(null); setDates((d) => ({ ...d, al: e.target.value })); }} />
              </div>
              <input type="hidden" name="ora_ritiro" value={dates.ora_ritiro} />
              <input type="hidden" name="ora_riconsegna" value={dates.ora_riconsegna} />
            </>
          ) : (
            <>
              <div>
                <label htmlFor="h-da" className="label">Da quando</label>
                <input id="h-da" name="dal" type="date" min={today} className="field" value={longFrom} onChange={(e) => setLongFrom(e.target.value)} />
              </div>
              <div>
                <label htmlFor="h-mesi" className="label">Per quanto</label>
                <select id="h-mesi" name="mesi" className="field" defaultValue="3">
                  {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m === 1 ? "1 mese" : `${m} mesi`}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {mode === "breve" && (
          <div className="flex flex-wrap gap-2">
            {(["oggi", "domani", "weekend"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={quick === k}
                onClick={() => { setQuick(k); setDates(shortcut(k)); }}
                className={`chip ${quick === k ? "chip-on" : ""}`}>
                {k === "oggi" ? "Oggi" : k === "domani" ? "Domani" : "Questo weekend"}
              </button>
            ))}
          </div>
        )}

        <fieldset>
          <legend className="label">Cosa</legend>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <input type="hidden" name="cat" value={cat} />
            {[{ slug: "", name: "Tutto" }, ...CATEGORIES].map((c) => (
              <button key={c.slug || "all"} type="button" aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}
                className={`chip flex-none ${cat === c.slug ? "chip-on" : ""}`}>
                {c.slug && <CategoryIcon slug={c.slug} className="h-4 w-4" />}
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "lungo" && (
          <p className="text-sm text-mute">Per noleggi di uno o più mesi vedi il totale calcolato con le tariffe settimanali e mensili dei noleggiatori.</p>
        )}
        <button type="submit" className="btn-primary w-full sm:w-auto sm:px-10">Cerca</button>
      </form>
    </div>
  );
}

/** Barra di ricerca compatta della pagina risultati. Su mobile si apre da un riepilogo. */
export function SearchForm({ values = {}, summary }: { values?: SearchValues; summary?: string }) {
  const [open, setOpen] = useState(false);
  const form = (
    <form action="/cerca" method="get" className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
      <div>
        <label htmlFor="s-luogo" className="label">Dove</label>
        <PlaceInput id="s-luogo" name={values.luogo} lat={values.lat} lng={values.lng} />
      </div>
      <div>
        <label htmlFor="s-dal" className="label">Ritiro</label>
        <input id="s-dal" name="dal" type="date" className="field" defaultValue={values.dal ?? ""} />
      </div>
      <div>
        <label htmlFor="s-al" className="label">Riconsegna</label>
        <input id="s-al" name="al" type="date" className="field" defaultValue={values.al ?? ""} />
      </div>
      {values.ora_ritiro && <input type="hidden" name="ora_ritiro" value={values.ora_ritiro} />}
      {values.ora_riconsegna && <input type="hidden" name="ora_riconsegna" value={values.ora_riconsegna} />}
      <div>
        <label htmlFor="s-cat" className="label">Cosa</label>
        <select id="s-cat" name="cat" className="field" defaultValue={values.cat ?? ""}>
          <option value="">Tutto</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full">Cerca</button>
      </div>
    </form>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-full border border-line bg-white px-4 py-2.5 text-left shadow-sm lg:hidden">
        <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-teal-600" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{summary || "Dove, quando, cosa"}</span>
        <span className="text-xs font-semibold text-teal-600">{open ? "Chiudi" : "Modifica"}</span>
      </button>
      <div className={`${open ? "mt-3 block" : "hidden"} lg:mt-0 lg:block`}>{form}</div>
    </>
  );
}
