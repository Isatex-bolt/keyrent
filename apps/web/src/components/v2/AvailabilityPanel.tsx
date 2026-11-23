"use client";

import { useState } from "react";
import Link from "next/link";
import type { DayState, FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { BookingSheet } from "./BookingSheet";

/** Calendario disponibilità del singolo mezzo, stile pannello scuro: anno, mesi a schede, griglia del mese. */
const CELL: Record<DayState, string> = {
  free: "bg-[#173f2f] text-white/90 hover:bg-[#1d4d3a]",
  partial: "bg-[#173f2f] text-white/90 shadow-[inset_0_-3px_0_#b4473f] hover:bg-[#1d4d3a]",
  booked: "bg-[#7a2a26] text-white hover:bg-[#8c322d]",
  pending: "bg-[#6b5520] text-white hover:bg-[#7a6126]",
  off: "bg-[#9aa1aa] text-white/90",
};
const LEG: [DayState, string][] = [["free", "Disponibile"], ["booked", "Prenotato"], ["pending", "In attesa"], ["off", "Non disponibile"]];
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const WD = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function AvailabilityPanel({ vehicle, days, bookings, today, mese, hrefFor }: {
  vehicle: FleetVehicle; days: string[]; bookings: FleetBooking[]; today: string; mese: string;
  /** link già pronti per ogni mese "YYYY-MM" mostrato (anno precedente/successivo + 6 mesi) */
  hrefFor: Record<string, string>;
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
    <section className="overflow-hidden rounded-2xl bg-[#0d1520] text-white shadow-xl ring-1 ring-white/5">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-lg font-semibold tracking-tight">Calendario disponibilità</h2>
        <div className="flex items-center gap-3 text-sm">
          <Link scroll={false} href={hrefFor[key(y - 1, m)]} aria-label="Anno precedente" className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10">‹</Link>
          <span className="w-12 text-center font-semibold tabular-nums">{y}</span>
          <Link scroll={false} href={hrefFor[key(y + 1, m)]} aria-label="Anno successivo" className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10">›</Link>
        </div>
      </div>
      <div className="mx-4 grid grid-cols-6 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/5">
        {half.map((mm) => (
          <Link key={mm} scroll={false} href={hrefFor[key(y, mm)]}
            className={`rounded-lg py-2 text-center text-sm transition ${mm === m ? "bg-[#e8d5ae] font-semibold text-[#0d1520]" : "text-white/75 hover:bg-white/10"}`}>
            {MONTHS[mm - 1]}
          </Link>
        ))}
      </div>
      <div key={mese} className="p-4 animate-[fadeIn_.25s_ease-out]">
        <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-white/50">
          {WD.map((w) => <div key={w} className="pb-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/10">
          {cells.map((c, i) => {
            if (!c.day) return <div key={i} className="grid h-11 place-items-center bg-[#0d1520] text-sm text-white/25 sm:h-12">{c.label}</div>;
            const st = vehicle.days[c.day]?.state ?? "off";
            const isToday = c.day === today;
            return (
              <button key={i} onClick={() => setSel(c.day!)}
                className={`grid h-11 place-items-center text-sm font-medium tabular-nums transition sm:h-12 ${isToday ? "bg-[#e8d5ae] font-semibold text-[#0d1520]" : CELL[st]} ${c.day < today && !isToday ? "opacity-55" : ""}`}>
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/60">
          {LEG.map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${CELL[k].split(" ")[0]}`} />{l}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e8d5ae]" />Oggi</span>
        </div>
      </div>
      {sel && <BookingSheet vehicle={vehicle} day={sel} bookings={bookings} onClose={() => setSel(null)} />}
    </section>
  );
}
