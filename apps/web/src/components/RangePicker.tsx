"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Calendario KeyRent (al posto di quello del telefono, che chiede sempre "OK").
 * Periodo: tocchi il ritiro, poi la riconsegna → si chiude da solo. Stesso giorno = tocchi due volte lo stesso giorno.
 * Data singola: un tocco e si chiude. Su telefono si apre dal basso, su computer al centro.
 */
const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T12:00:00Z`);
export const shortDate = (s: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(parse(s));

export function RangePicker({ open, onClose, start, end, min, single = false, onChange, title }: {
  open: boolean; onClose: () => void; start: string; end: string; min?: string; single?: boolean;
  onChange: (v: { dal: string; al: string }) => void; title?: string;
}) {
  const [a, setA] = useState(start);
  const [b, setB] = useState(end);
  const [picking, setPicking] = useState<"start" | "end">("start");
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- all'apertura riparte dalle date attuali
    setA(start); setB(end); setPicking("start");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, start, end]);

  // "oggi" solo quando il calendario è aperto (mai durante il render sul server)
  const today = min || (open ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()) : "2000-01-01");
  const months = useMemo(() => {
    const t = parse(today);
    return Array.from({ length: 12 }, (_, k) => new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + k, 1)));
  }, [today]);

  if (!open) return null;

  function tap(day: string) {
    if (single) { onChange({ dal: day, al: day }); onClose(); return; }
    if (picking === "start" || (a && day < a)) { setA(day); setB(""); setPicking("end"); return; }
    setB(day);
    onChange({ dal: a, al: day });
    setTimeout(onClose, 180); // il tempo di vedere il periodo evidenziato
  }

  const fmtMonth = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
  const head = single
    ? (a ? shortDate(a) : "Scegli la data")
    : `${a ? shortDate(a) : "Ritiro"} → ${b ? shortDate(b) : picking === "end" ? "tocca la riconsegna" : "Riconsegna"}`;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button type="button" aria-label="Chiudi calendario" onClick={onClose} className="absolute inset-0 animate-[kr-fade_.2s_ease-out] bg-navy-950/50" />
      <div role="dialog" aria-modal="true" aria-label={title ?? "Scegli le date"}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-[kr-up_.25s_cubic-bezier(.2,.8,.2,1)] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="flex-none border-b border-line px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{title ?? (single ? "Da quando" : "Ritiro e riconsegna")}</p>
            <button type="button" onClick={onClose} className="h-9 rounded-full px-3 text-sm font-semibold text-mute hover:bg-navy-50">Chiudi</button>
          </div>
          <p className="mt-1 text-[15px] font-medium text-teal-600">{head}</p>
          <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-mute">
            {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          {months.map((m) => {
            const y = m.getUTCFullYear(), mo = m.getUTCMonth();
            const firstDow = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7;
            const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
            return (
              <section key={`${y}-${mo}`}>
                <h3 className="mb-2 font-semibold capitalize">{fmtMonth.format(m)}</h3>
                <div className="grid grid-cols-7 gap-y-1">
                  {Array.from({ length: firstDow }).map((_, i) => <span key={`e${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const day = ymd(new Date(Date.UTC(y, mo, i + 1)));
                    const past = day < today;
                    const isA = day === a, isB = day === b;
                    const inRange = a && b && day > a && day < b;
                    return (
                      <button key={day} type="button" disabled={past} onClick={() => tap(day)} aria-pressed={isA || isB}
                        className={`relative h-11 text-[15px] disabled:text-mute/40 ${inRange ? "bg-teal-50" : ""} ${isA && b && b !== a ? "rounded-l-full bg-teal-50" : ""} ${isB && a !== b ? "rounded-r-full bg-teal-50" : ""}`}>
                        <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${isA || isB ? "bg-navy-900 font-semibold text-white" : !past ? "hover:bg-navy-50" : ""}`}>{i + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Due date compatte ("sab 28 nov → dom 29 nov") che aprono il calendario KeyRent. Invia i campi dal/al. */
export function DateRange({ dal, al, min, onChange, names = ["dal", "al"], className = "", placeholder = ["Ritiro", "Riconsegna"] }: {
  dal: string; al: string; min?: string; onChange: (v: { dal: string; al: string }) => void;
  names?: [string, string]; className?: string; placeholder?: [string, string];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`grid w-full min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-1 py-3 text-left ${className}`}>
        <span className={`truncate text-[16px] ${dal ? "font-medium text-ink" : "text-mute/70"}`}>{dal ? shortDate(dal) : placeholder[0]}</span>
        <span aria-hidden className="text-mute">→</span>
        <span className={`truncate text-[16px] ${al ? "font-medium text-ink" : "text-mute/70"}`}>{al ? shortDate(al) : placeholder[1]}</span>
      </button>
      <input type="hidden" name={names[0]} value={dal} />
      <input type="hidden" name={names[1]} value={al} />
      <RangePicker open={open} onClose={() => setOpen(false)} start={dal} end={al} min={min} onChange={onChange} />
    </>
  );
}

/** Una data compatta che apre il calendario KeyRent: un tocco e si chiude. */
export function DateOne({ name, value, min, onChange, placeholder = "Scegli la data", title }: {
  name: string; value: string; min?: string; onChange: (v: string) => void; placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full min-w-0 py-3 text-left">
        <span className={`block truncate text-[16px] ${value ? "font-medium text-ink" : "text-mute/70"}`}>{value ? shortDate(value) : placeholder}</span>
      </button>
      <input type="hidden" name={name} value={value} />
      <RangePicker open={open} single title={title} onClose={() => setOpen(false)} start={value} end={value} min={min} onChange={(v) => onChange(v.dal)} />
    </>
  );
}
