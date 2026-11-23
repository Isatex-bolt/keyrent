"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/catalog";
import { PlaceInput } from "./PlaceInput";
import { DateField } from "./DateField";

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
    // oggi = in giornata: ritiro fra un'ora, riconsegna la sera stessa
    return { dal: addDays(0), al: addDays(0), ora_ritiro: `${String(start).padStart(2, "0")}:00`, ora_riconsegna: start >= 19 ? "21:00" : "19:00" };
  }
  if (kind === "domani") return { dal: addDays(1), al: addDays(1), ora_ritiro: "09:00", ora_riconsegna: "19:00" };
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(new Date()));
  const toSat = wd === 6 ? 0 : wd === 0 ? 6 : 6 - wd;
  return { dal: addDays(toSat), al: addDays(toSat + 1), ora_ritiro: "09:00", ora_riconsegna: "19:00" };
}

/** Stesso giorno: ritiro al mattino, riconsegna la sera. Più giorni: ore 10. */
function withTimes(d: { dal: string; al: string; ora_ritiro: string; ora_riconsegna: string }) {
  if (d.dal && d.dal === d.al) return { ...d, ora_ritiro: "09:00", ora_riconsegna: "19:00" };
  return { ...d, ora_ritiro: "10:00", ora_riconsegna: "10:00" };
}

/** Ricerca della home: Prenota | Lungo termine, Dove con suggerimenti, Quando con scorciatoie, Cosa a menu. */
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
      <h2 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">Noleggia ora</h2>
      <div role="tablist" aria-label="Durata del noleggio" className="mb-5 mt-3 inline-flex rounded-full bg-navy-50 p-1 text-sm font-semibold">
        {([["breve", "Breve termine"], ["lungo", "Lungo termine"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`rounded-full px-4 py-2 transition ${mode === k ? "bg-navy-900 text-white shadow-sm" : "text-mute hover:text-navy-900"}`}>
            {l}
          </button>
        ))}
      </div>

      <form action="/cerca" method="get" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="h-luogo" className="label">Dove</label>
            <PlaceInput id="h-luogo" />
          </div>
          {mode === "breve" ? (
            <>
              <div>
                <label htmlFor="h-dal" className="label">Ritiro</label>
                <DateField id="h-dal" name="dal" min={today} value={dates.dal} placeholder="Data"
                  onChange={(v) => { setQuick(null); setDates((d) => withTimes({ ...d, dal: v, al: d.al && d.al >= v ? d.al : v })); }} />
              </div>
              <div>
                <label htmlFor="h-al" className="label">Riconsegna</label>
                <DateField id="h-al" name="al" min={dates.dal || today} value={dates.al} placeholder="Data"
                  onChange={(v) => { setQuick(null); setDates((d) => withTimes({ ...d, al: v })); }} />
              </div>
              <input type="hidden" name="ora_ritiro" value={dates.ora_ritiro} />
              <input type="hidden" name="ora_riconsegna" value={dates.ora_riconsegna} />
            </>
          ) : (
            <>
              <div>
                <label htmlFor="h-da" className="label">Da quando</label>
                <DateField id="h-da" name="dal" min={today} value={longFrom} onChange={setLongFrom} placeholder="Data" />
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
            {dates.dal && dates.al && (
              <p className="w-full text-sm text-mute">
                {dates.dal === dates.al ? "In giornata: " : ""}ritiro ore {dates.ora_ritiro}, riconsegna ore {dates.ora_riconsegna}
              </p>
            )}
          </div>
        )}

        {mode === "lungo" && (
          <p className="text-sm text-mute">Per noleggi di uno o più mesi vedi il totale calcolato con le tariffe settimanali e mensili dei noleggiatori.</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-80">
            <label htmlFor="h-cat" className="label">Cosa</label>
            <select id="h-cat" name="cat" className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Tutti i mezzi</option>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-48">Cerca</button>
        </div>
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
        <DateField id="s-dal" name="dal" defaultValue={values.dal ?? ""} />
      </div>
      <div>
        <label htmlFor="s-al" className="label">Riconsegna</label>
        <DateField id="s-al" name="al" defaultValue={values.al ?? ""} />
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
