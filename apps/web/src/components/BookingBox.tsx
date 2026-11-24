"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DateRange } from "./RangePicker";
import { durationLabel, euro } from "@/lib/format";

type Quote = { total_cents: number; qty: number; unit: string } | { error: string } | null;
const HOURS = Array.from({ length: 31 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/** Date e orari del noleggio: il totale si aggiorna da solo, poi un solo pulsante per prenotare. */
export function BookingBox({ id, from, initial, initialQuote, busy: busyDays = [] }: {
  id: string; from: string; busy?: string[]; initial: { dal?: string; al?: string; oraR: string; oraC: string }; initialQuote: Quote;
}) {
  const [dal, setDal] = useState(initial.dal ?? "");
  const [al, setAl] = useState(initial.al ?? "");
  const [oraR, setOraR] = useState(initial.oraR);
  const [oraC, setOraC] = useState(initial.oraC);
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!dal || !al) { setQuote(null); return; }
    const ctrl = new AbortController();
    setBusy(true);
    const qs = new URLSearchParams({ id, dal, al, ora_ritiro: oraR, ora_riconsegna: oraC });
    fetch(`/api/preventivo?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((q) => setQuote(q)).catch(() => undefined).finally(() => setBusy(false));
    // l'indirizzo della pagina tiene le date (link condivisibile, tasto indietro)
    window.history.replaceState(null, "", `?${new URLSearchParams({ dal, al, ora_ritiro: oraR, ora_riconsegna: oraC })}`);
    return () => ctrl.abort();
  }, [id, dal, al, oraR, oraC]);

  const taken = !!dal && !!al && busyDays.some((d) => d >= dal && d <= al);
  const ok = quote && !("error" in quote) && !taken;
  const href = `/prenota/${id}?${new URLSearchParams({ ...(dal ? { dal, ora_ritiro: oraR } : {}), ...(al ? { al, ora_riconsegna: oraC } : {}) })}`;
  return (
    <>
      <div>
        <span className="label">Ritiro → Riconsegna</span>
        <div className="field flex items-center !py-0">
          <DateRange dal={dal} al={al} min={from} busy={busyDays} placeholder={["Ritiro", "Riconsegna"]} names={["dal_v", "al_v"]} className="!py-2.5"
            onChange={(v) => { setDal(v.dal); setAl(v.al); }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <select aria-label="Ora di ritiro" value={oraR} onChange={(e) => setOraR(e.target.value)} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
          <select aria-label="Ora di riconsegna" value={oraC} onChange={(e) => setOraC(e.target.value)} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
        </div>
      </div>
      {taken ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Il mezzo è già occupato in alcune di queste date: tocca le date e scegline altre (i giorni barrati sono occupati).</p>
      ) : ok ? (
        <div className={`rounded-xl bg-navy-50 p-4 transition ${busy ? "opacity-60" : ""}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-mute">Totale noleggio</span>
            <span className="text-2xl font-bold">{euro(quote.total_cents)}</span>
          </div>
          <p className="mt-1 text-xs text-mute">{durationLabel(quote.qty, quote.unit)} · cauzione esclusa</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8.6 13.2L5.8 10.4l1.1-1.1 1.7 1.7 4.5-4.5 1.1 1.1z"/></svg>
            Libero nelle tue date
          </p>
        </div>
      ) : quote && "error" in quote ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{quote.error}</p>
      ) : busy ? (
        <div className="h-[76px] animate-pulse rounded-xl bg-navy-50" />
      ) : (
        <p className="rounded-xl bg-navy-50 p-3 text-center text-sm text-mute">Scegli le date: il totale compare qui.</p>
      )}
      <Link href={href} aria-disabled={!ok}
        className={`btn-primary w-full ${ok ? "" : "pointer-events-none opacity-50"}`}>
        Effettua prenotazione
      </Link>
    </>
  );
}
