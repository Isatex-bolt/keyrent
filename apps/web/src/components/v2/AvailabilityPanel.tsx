"use client";

import { useState } from "react";
import Link from "next/link";
import type { FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { BookingSheet } from "./BookingSheet";
import { Legend, STATE } from "./ui";

/** Calendario disponibilità del singolo mezzo: anno, mesi a schede, griglia del mese (stessi colori della vista flotta). */
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const WD = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function AvailabilityPanel({ vehicle, days, bookings, today, mese, hrefFor, showLegend = true }: {
  vehicle: FleetVehicle; days: string[]; bookings: FleetBooking[]; today: string; mese: string;
  /** link già pronti per ogni mese "YYYY-MM" mostrato (anno precedente/successivo + 6 mesi) */
  hrefFor: Record<string, string>; showLegend?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [y, m] = mese.split("-").map(Number);
  const half = m <= 6 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  const key = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}`;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const cells: { label: number; day?: string }[] = [
    ...Array.from({ length: lead }, (_, i) => ({ label: prevLast - lead + 1 + i })),
    ...days.map((d) => ({ label: Number(d.slice(8)), day: d })),
  ];
  for (let n = 1; cells.length % 7 !== 0 || cells.length < 35; n++) cells.push({ label: n });

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="font-semibold">Calendario disponibilità</h2>
        <div className="flex items-center gap-3 text-sm">
          <Link scroll={false} href={hrefFor[key(y - 1, m)]} aria-label="Anno precedente" className="grid h-8 w-8 place-items-center rounded-full border border-line text-navy-900 hover:bg-navy-50">‹</Link>
          <span className="w-12 text-center font-semibold tabular-nums text-navy-900">{y}</span>
          <Link scroll={false} href={hrefFor[key(y + 1, m)]} aria-label="Anno successivo" className="grid h-8 w-8 place-items-center rounded-full border border-line text-navy-900 hover:bg-navy-50">›</Link>
        </div>
      </div>
      <div className="mx-4 grid grid-cols-6 rounded-xl bg-navy-50 p-1">
        {half.map((mm) => (
          <Link key={mm} scroll={false} href={hrefFor[key(y, mm)]}
            className={`rounded-lg py-2 text-center text-sm transition ${mm === m ? "bg-navy-900 font-semibold text-white shadow-sm" : "text-mute hover:bg-white hover:text-navy-900"}`}>
            {MONTHS[mm - 1]}
          </Link>
        ))}
      </div>
      <div key={mese} className="p-4 animate-[fadeIn_.25s_ease-out]">
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-mute">
          {WD.map((w) => <div key={w} className="pb-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c, i) => {
            if (!c.day) return <div key={i} className="grid h-11 place-items-center text-sm text-mute/40 sm:h-12">{c.label}</div>;
            const st = vehicle.days[c.day]?.state ?? "off";
            const isToday = c.day === today;
            return (
              <button key={i} onClick={() => setSel(c.day!)}
                className={`grid h-11 place-items-center rounded-xl text-sm font-semibold tabular-nums ring-1 ring-inset transition hover:scale-105 active:scale-95 sm:h-12 ${STATE[st].cell} ${isToday ? "outline outline-2 outline-offset-2 outline-teal-500" : ""} ${c.day < today && !isToday ? "opacity-50" : ""}`}>
                {c.label}
              </button>
            );
          })}
        </div>
        {showLegend && <div className="mt-4"><Legend pool={vehicle.quantityMode === "pool"} /></div>}
      </div>
      {sel && <BookingSheet vehicle={vehicle} day={sel} bookings={bookings} onClose={() => setSel(null)} />}
    </section>
  );
}
