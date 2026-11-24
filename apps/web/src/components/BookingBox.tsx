"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DateRange } from "./RangePicker";
import { PlaceInput } from "./PlaceInput";
import { durationLabel, euro, fixTimes } from "@/lib/format";

type Delivery = { radius_km: number; fee_cents: number; per_km_cents: number };
type DQ = { km: number; cents: number | null; in_range: boolean; radius_km: number } | { error: string } | null;
type Quote = { total_cents: number; qty: number; unit: string } | { error: string } | null;
const HOURS = Array.from({ length: 36 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

const shortIt = (d: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** Date e orari del noleggio: il totale si aggiorna da solo, poi un solo pulsante per prenotare. */
export function BookingBox({ id, from, initial, initialQuote, busy: busyDays = [], delivery = null, forCompany = false, fromPrice = 0 }: {
  id: string; from: string; busy?: string[]; delivery?: Delivery | null; forCompany?: boolean; fromPrice?: number; initial: { dal?: string; al?: string; oraR: string; oraC: string }; initialQuote: Quote;
}) {
  const [dal, setDal] = useState(initial.dal ?? "");
  const [al, setAl] = useState(initial.al ?? "");
  const [oraR, setOraR] = useState(initial.oraR);
  const [oraC, setOraC] = useState(initial.oraC);
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);
  // consegna: a casa (privato) o in azienda (azienda cliente), prezzo calcolato dal database
  const [wants, setWants] = useState(false);
  const [place, setPlace] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [dq, setDq] = useState<DQ>(null);
  const [locating, setLocating] = useState(false);
  const where = forCompany ? "in azienda" : "a casa";

  useEffect(() => {
    if (!wants || !place) return;
    const ctrl = new AbortController();
    fetch(`/api/consegna?${new URLSearchParams({ id, lat: String(place.lat), lng: String(place.lng) })}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((q) => setDq(q)).catch(() => undefined);
    return () => ctrl.abort();
  }, [id, wants, place]);

  function myPosition() {
    if (!navigator.geolocation) { setDq({ error: "Il telefono non permette di leggere la posizione: scrivi l'indirizzo." }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPlace({ label: "La tua posizione attuale", lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { setLocating(false); setDq({ error: "Posizione non disponibile: consenti l'accesso alla posizione o scrivi l'indirizzo." }); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

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
  const dOk = dq && !("error" in dq) && dq.in_range && dq.cents !== null ? dq : null;
  const deliveryPending = wants && !dOk; // consegna chiesta ma senza prezzo valido
  const ok = quote && !("error" in quote) && !taken && !deliveryPending;
  const total = quote && !("error" in quote) ? quote.total_cents + (wants && dOk ? dOk.cents ?? 0 : 0) : 0;
  const href = `/prenota/${id}?${new URLSearchParams({
    ...(dal ? { dal, ora_ritiro: oraR } : {}), ...(al ? { al, ora_riconsegna: oraC } : {}),
    ...(wants && dOk && place ? { consegna: "1", c_lat: place.lat.toFixed(5), c_lng: place.lng.toFixed(5), c_ind: place.label } : {}),
  })}`;
  return (
    <>
      <div>
        <span className="label">Ritiro → Riconsegna</span>
        <div className="field flex items-center !py-0">
          <DateRange dal={dal} al={al} min={from} busy={busyDays} placeholder={["Ritiro", "Riconsegna"]} names={["dal_v", "al_v"]} className="!py-2.5"
            onChange={(v) => { const t = fixTimes(v.dal, v.al, oraR, oraC); setDal(v.dal); setAl(v.al); setOraR(t.oraR); setOraC(t.oraC); }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <select aria-label="Ora di ritiro" value={oraR} onChange={(e) => { const t = dal && al ? fixTimes(dal, al, e.target.value, oraC) : { oraR: e.target.value, oraC }; setOraR(t.oraR); setOraC(t.oraC); }} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
          <select aria-label="Ora di riconsegna" value={oraC} onChange={(e) => setOraC(e.target.value)} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
        </div>
      </div>
      {delivery && (
        <div className={`rounded-xl border p-3 transition ${wants ? "border-teal-500 bg-teal-50/40" : "border-line"}`}>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={wants} onChange={(e) => { setWants(e.target.checked); if (!e.target.checked) setDq(null); }} className="h-5 w-5 accent-teal-600" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Consegna {where}</span>
              <span className="block text-xs text-mute">Entro {delivery.radius_km} km · {[delivery.fee_cents ? euro(delivery.fee_cents) : "", delivery.per_km_cents ? `${euro(delivery.per_km_cents, true)}/km` : ""].filter(Boolean).join(" + ") || "gratuita"}</span>
            </span>
          </label>
          {wants && (
            <div className="mt-3 space-y-2">
              <PlaceInput className="field" placeholder={forCompany ? "Indirizzo dell'azienda" : "Il tuo indirizzo"}
                onPick={(p) => { setPlace(p); if (!p) setDq(null); }} />
              <button type="button" onClick={myPosition} className="text-sm font-semibold text-teal-700">
                {locating ? "Cerco la tua posizione…" : "Usa la mia posizione"}
              </button>
              {place && <p className="truncate text-xs text-mute">Consegna a: {place.label}</p>}
              {dq && "error" in dq ? <p className="text-sm text-amber-800">{dq.error}</p>
                : dq && !dq.in_range ? <p className="text-sm text-amber-800">Sei a circa {dq.km} km: il noleggiatore consegna entro {dq.radius_km} km. Puoi ritirare il mezzo in sede.</p>
                : dOk ? <p className="flex justify-between text-sm"><span>Consegna · circa {dOk.km} km</span><span className="font-semibold">{euro(dOk.cents ?? 0)}</span></p>
                : <p className="text-xs text-mute">Scrivi l&apos;indirizzo o usa la tua posizione: il prezzo compare qui.</p>}
            </div>
          )}
        </div>
      )}
      {taken ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Il mezzo è già occupato in alcune di queste date: tocca le date e scegline altre (i giorni barrati sono occupati).</p>
      ) : quote && !("error" in quote) ? (
        <div className={`rounded-xl bg-navy-50 p-4 transition ${busy ? "opacity-60" : ""}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-mute">{wants && dOk ? "Totale con consegna" : "Totale noleggio"}</span>
            <span className="text-2xl font-bold">{euro(total)}</span>
          </div>
          <p className="mt-1 text-xs text-mute">{durationLabel(quote.qty, quote.unit)}{wants && dOk ? ` · noleggio ${euro(quote.total_cents)} + consegna ${euro(dOk.cents ?? 0)}` : ""} · cauzione esclusa</p>
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

      {/* telefono: prezzo sempre visibile in basso + Prenota (stile Booking) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white shadow-[0_-6px_20px_rgba(3,16,38,0.10)] lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {ok ? (
            <>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{euro(total)} <span className="text-sm font-medium text-mute">totale</span></p>
                <p className="truncate text-xs text-mute">{shortIt(dal)}{dal !== al ? ` → ${shortIt(al)}` : ""}{wants ? ` · consegna ${where}` : ""}</p>
              </div>
              <Link href={href} className="flex min-h-12 flex-none items-center rounded-xl bg-navy-900 px-7 font-semibold text-white">Prenota</Link>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{fromPrice ? <>da {euro(fromPrice)} <span className="text-sm font-medium text-mute">/ giorno</span></> : "Prezzo su richiesta"}</p>
                <p className="truncate text-xs text-mute">{deliveryPending && quote && !("error" in quote) ? "Indica dove consegnare" : "Nessun addebito finché il noleggiatore non conferma"}</p>
              </div>
              <a href="#prenota" className="flex min-h-12 flex-none items-center rounded-xl bg-navy-900 px-6 font-semibold text-white">{dal && al ? "Completa" : "Scegli le date"}</a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
