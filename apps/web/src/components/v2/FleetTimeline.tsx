"use client";

import { useState } from "react";
import Link from "next/link";
import type { FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { BookingSheet } from "./BookingSheet";
import { STATE, WEEKDAY, dayNum, weekday } from "./ui";

/** Vista gestionale: righe = mezzi, colonne = giorni. Tocca una casella per il dettaglio. */
export function FleetTimeline({ vehicles, days, bookings, today, vehicleBase, qs = "" }: {
  vehicles: FleetVehicle[]; days: string[]; bookings: FleetBooking[]; today: string; vehicleBase?: string; qs?: string;
}) {
  const vehicleHref = vehicleBase ? (id: string) => `${vehicleBase}/${id}${qs}` : null;
  const [sel, setSel] = useState<{ v: FleetVehicle; d: string } | null>(null);
  if (!vehicles.length) return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-mute">Nessun mezzo con questi filtri.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-40 min-w-40 border-b border-line bg-white px-3 py-2 text-left font-semibold text-mute sm:w-56 sm:min-w-56">Mezzo</th>
              {days.map((d) => (
                <th key={d} className={`border-b border-line px-0.5 py-1.5 text-center font-medium ${d === today ? "text-teal-600" : weekday(d) > 4 ? "text-navy-700" : "text-mute"}`}>
                  <div className="text-[10px] uppercase">{WEEKDAY[weekday(d)]}</div>
                  <div className={`mx-auto grid h-6 w-6 place-items-center rounded-full ${d === today ? "bg-teal-500 font-bold text-white" : ""}`}>{dayNum(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="group">
                <td className="sticky left-0 z-10 border-b border-line bg-white px-3 py-2 group-hover:bg-navy-50/60">
                  {vehicleHref ? (
                    <Link href={vehicleHref(v.id)} className="block truncate font-semibold text-navy-900 hover:text-teal-600">{v.title}</Link>
                  ) : <span className="block truncate font-semibold text-navy-900">{v.title}</span>}
                  <span className="block truncate text-[11px] text-mute">{v.category} · {v.locationName}{v.quantityMode === "pool" ? ` · ${v.units} unità` : ""}</span>
                </td>
                {days.map((d) => {
                  const c = v.days[d];
                  const s = STATE[c?.state ?? "off"];
                  return (
                    <td key={d} className="border-b border-line p-[3px] group-hover:bg-navy-50/60">
                      <button onClick={() => setSel({ v, d })} title={`${s.label}${v.quantityMode === "pool" && c ? ` · ${c.free}/${v.units} liberi` : ""}`}
                        className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-bold ring-1 ring-inset transition hover:scale-110 active:scale-95 sm:h-9 sm:w-9 ${s.cell} ${d === today ? "outline outline-2 outline-offset-1 outline-teal-500" : ""}`}>
                        {v.quantityMode === "pool" && c && c.state !== "off" ? c.free : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && <BookingSheet vehicle={sel.v} day={sel.d} bookings={bookings} onClose={() => setSel(null)} />}
    </div>
  );
}
