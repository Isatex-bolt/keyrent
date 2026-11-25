"use client";

import { useEffect } from "react";
import type { FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { STATE, euroShort, shortDate } from "./ui";

const BOOKING_LABEL: Record<string, string> = {
  requested: "Da confermare", accepted: "Accettata", confirmed: "Confermata · da ritirare", picked_up: "In corso", completed: "Conclusa",
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
  const dateLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-navy-950/30 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl animate-[sheetUp_.22s_cubic-bezier(.2,.8,.2,1)] sm:rounded-3xl sm:pb-5">
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
                  <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">{BOOKING_LABEL[b.status] ?? b.status}</span>
                </div>
                <p className="mt-1 text-xs text-mute">Prenotazione {b.code}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-mute">Ritiro</dt><dd className="font-medium">{shortDate(b.pickupAt)}</dd></div>
                  <div><dt className="text-xs text-mute">Rientro</dt><dd className="font-medium">{shortDate(b.returnAt)}</dd></div>
                  <div><dt className="text-xs text-mute">Totale</dt><dd className="font-medium">{euroShort(b.totalCents)}</dd></div>
                  <div><dt className="text-xs text-mute">Il tuo netto</dt><dd className="font-medium">{euroShort(b.netCents)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-mute">Nessuna prenotazione in questo giorno.</p>
            {["Blocca giorno", "Crea prenotazione manuale", "Imposta manutenzione"].map((a) => (
              <button key={a} disabled className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-sm font-medium text-mute">
                {a}<span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase">presto</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose} className="btn-ghost mt-4 w-full">Chiudi</button>
      </div>
    </div>
  );
}
