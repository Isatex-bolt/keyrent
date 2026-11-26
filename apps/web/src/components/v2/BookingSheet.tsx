"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { STATE, euroShort, shortDate } from "./ui";
import { blockDays } from "@/app/pro/calendario/blockActions";
import { cancelManual } from "@/app/pro/prenotazioni/manuale/actions";
import { SubmitOnce } from "@/components/SubmitOnce";

const BOOKING_LABEL: Record<string, string> = {
  requested: "Da confermare", accepted: "Accettata", confirmed: "Confermata · da ritirare", picked_up: "In corso", completed: "Conclusa",
  manual: "Manuale",
};

/** Dettaglio di un giorno: bottom sheet su telefono, riquadro laterale su computer. */
export function BookingSheet({ vehicle, day, bookings, onClose }: {
  vehicle: FleetVehicle; day: string; bookings: FleetBooking[]; onClose: () => void;
}) {
  const info = vehicle.days[day];
  const list = bookings.filter((b) => info?.bookingIds.includes(b.id));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  // per tornare qui dopo un'azione (calendario o dashboard, con i filtri)
  // (il riquadro si apre solo dopo un tocco, quindi sempre nel browser)
  const [back] = useState(() => (typeof window === "undefined" ? "/pro/calendario" : (() => { const u = new URL(window.location.href); u.searchParams.delete("ok"); u.searchParams.delete("errore"); return u.pathname + u.search; })()));
  const canAdd = !info || info.state === "free" || info.state === "partial";
  const dateLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-navy-950/30 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]" />
      <div className="relative max-h-[88svh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl animate-[sheetUp_.22s_cubic-bezier(.2,.8,.2,1)] sm:rounded-3xl sm:pb-5">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">{dateLabel}</p>
            <h3 className="text-lg font-bold">{vehicle.title}</h3>
            <p className="text-sm text-mute">{vehicle.locationName}</p>
          </div>
          {info && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATE[info.state].cell}`}>{STATE[info.state].label}</span>}
        </div>
        {vehicle.quantityMode === "pool" && info && (
          <p className="mt-2 text-sm">{info.free} su {vehicle.units} disponibili</p>
        )}
        {list.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {list.map((b) => (
              <li key={b.id} className="rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{b.customer}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.manual ? "bg-amber-100 text-amber-900" : "bg-navy-50 text-navy-800"}`}>{BOOKING_LABEL[b.status] ?? b.status}</span>
                </div>
                <p className="mt-1 text-xs text-mute">{b.manual ? "Presa al telefono / al banco" : "Prenotazione KeyRent"} · {b.code}</p>
                {b.manual?.contact && <p className="mt-1 text-sm"><a className="font-semibold text-navy-800 underline" href={/^[+\d\s]+$/.test(b.manual.contact) ? `tel:${b.manual.contact.replace(/\s+/g, "")}` : `mailto:${b.manual.contact}`}>{b.manual.contact}</a></p>}
                {b.manual?.note && <p className="mt-1 text-sm text-mute">“{b.manual.note}”</p>}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-mute">Ritiro</dt><dd className="font-medium">{shortDate(b.pickupAt)}</dd></div>
                  <div><dt className="text-xs text-mute">Rientro</dt><dd className="font-medium">{shortDate(b.returnAt)}</dd></div>
                  <div><dt className="text-xs text-mute">{b.manual ? "Prezzo concordato" : "Totale"}</dt><dd className="font-medium">{euroShort(b.totalCents)}</dd></div>
                  {!b.manual && <div><dt className="text-xs text-mute">Il tuo netto</dt><dd className="font-medium">{euroShort(b.netCents)}</dd></div>}
                </dl>
                {b.manual && (
                  <div className="mt-3 flex gap-2">
                    <Link href={`/pro/prenotazioni/manuale/${b.id}?back=${encodeURIComponent(back)}`} className="btn-ghost flex-1 justify-center py-2 text-sm">Modifica</Link>
                    <form action={cancelManual} className="flex-1" onSubmit={(e) => { if (!confirm("Annullare questa prenotazione? Il mezzo torna libero.")) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={back} />
                      <SubmitOnce className="w-full rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" pendingText="Annullo…">Annulla</SubmitOnce>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-mute">Nessuna prenotazione in questo giorno.</p>
        )}
        {canAdd && (
          <div className="mt-4 space-y-2">
            <Link href={`/pro/prenotazioni/manuale/nuova?mezzo=${vehicle.id}&dal=${day}&back=${encodeURIComponent(back)}`}
              className="btn-primary flex w-full justify-center py-3">+ Prenotazione manuale</Link>
            <div className="grid grid-cols-2 gap-2">
              {([["block", "Blocca giorno"], ["maintenance", "Manutenzione"]] as const).map(([kind, label]) => (
                <form key={kind} action={blockDays}>
                  <input type="hidden" name="listing_id" value={vehicle.id} /><input type="hidden" name="dal" value={day} />
                  <input type="hidden" name="al" value={day} /><input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="qty" value={1} /><input type="hidden" name="back" value={back} />
                  <SubmitOnce className="btn-ghost w-full justify-center py-2.5 text-sm" pendingText="…">{label}</SubmitOnce>
                </form>
              ))}
            </div>
            <p className="text-xs text-mute">Per bloccare più giorni o più unità usa “Blocca giorni” nel calendario del singolo mezzo.</p>
          </div>
        )}
        <button onClick={onClose} className="btn-ghost mt-4 w-full">Chiudi</button>
      </div>
    </div>
  );
}
