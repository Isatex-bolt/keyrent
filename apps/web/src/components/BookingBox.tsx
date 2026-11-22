"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DateField } from "./DateField";
import { durationLabel, euro } from "@/lib/format";

type Quote = { total_cents: number; qty: number; unit: string } | { error: string } | null;
const HOURS = Array.from({ length: 31 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/** Date e orari del noleggio: il totale si aggiorna da solo, poi un solo pulsante per prenotare. */
export function BookingBox({ id, from, initial, initialQuote }: {
  id: string; from: string; initial: { dal?: string; al?: string; oraR: string; oraC: string }; initialQuote: Quote;
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

  function pickDal(v: string) {
    setDal(v);
    if (v && (!al || al < v)) { setAl(v); setOraC("18:00"); }
  }

  const ok = quote && !("error" in quote);
  const href = `/prenota/${id}?${new URLSearchParams({ ...(dal ? { dal, ora_ritiro: oraR } : {}), ...(al ? { al, ora_riconsegna: oraC } : {}) })}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="q-dal">Ritiro</label>
          <DateField id="q-dal" name="dal" value={dal} onChange={pickDal} min={from} placeholder="Data" />
          <select aria-label="Ora di ritiro" value={oraR} onChange={(e) => setOraR(e.target.value)} className="field mt-2">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="q-al">Riconsegna</label>
          <DateField id="q-al" name="al" value={al} onChange={setAl} min={dal || from} placeholder="Data" />
          <select aria-label="Ora di riconsegna" value={oraC} onChange={(e) => setOraC(e.target.value)} className="field mt-2">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
        </div>
      </div>
      {ok ? (
        <div className={`rounded-xl bg-navy-50 p-4 transition ${busy ? "opacity-60" : ""}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-mute">Totale noleggio</span>
            <span className="text-2xl font-bold">{euro(quote.total_cents)}</span>
          </div>
          <p className="mt-1 text-xs text-mute">{durationLabel(quote.qty, quote.unit)} · cauzione esclusa</p>
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
