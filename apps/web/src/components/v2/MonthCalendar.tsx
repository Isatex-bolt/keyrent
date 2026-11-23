"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { BookingSheet } from "./BookingSheet";
import { STATE, WEEKDAY, dayNum, monthLabel, weekday } from "./ui";

/** Calendario mensile di un mezzo: frecce o swipe per cambiare mese, tocco sul giorno per il dettaglio. */
export function MonthCalendar({ vehicle, days, bookings, today, mese, prevHref, nextHref, compact = false }: {
  vehicle: FleetVehicle; days: string[]; bookings: FleetBooking[]; today: string; mese: string;
  prevHref?: string; nextHref?: string; compact?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const router = useRouter();
  const touch = useRef<number | null>(null);
  const lead = days.length ? weekday(days[0]) : 0;
  const counts = days.reduce((acc, d) => { const s = vehicle.days[d]?.state ?? "off"; acc[s] = (acc[s] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return (
    <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-4"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current; touch.current = null;
        if (Math.abs(dx) > 60) { const h = dx < 0 ? nextHref : prevHref; if (h) router.push(h, { scroll: false }); }
      }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold capitalize">{monthLabel(mese)}</p>
        {(prevHref || nextHref) && (
          <div className="flex gap-1">
            {prevHref && <Link scroll={false} href={prevHref} aria-label="Mese precedente" className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-navy-50">‹</Link>}
            {nextHref && <Link scroll={false} href={nextHref} aria-label="Mese successivo" className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-navy-50">›</Link>}
          </div>
        )}
      </div>
      <div key={mese} className="grid grid-cols-7 gap-1 animate-[fadeIn_.25s_ease-out]">
        {WEEKDAY.map((w, i) => <div key={i} className="pb-1 text-center text-[10px] font-semibold uppercase text-mute">{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`x${i}`} />)}
        {days.map((d) => {
          const c = vehicle.days[d]; const s = STATE[c?.state ?? "off"];
          return (
            <button key={d} onClick={() => setSel(d)}
              className={`relative grid aspect-square place-items-center rounded-xl text-sm font-semibold ring-1 ring-inset transition hover:scale-105 active:scale-95 ${s.cell} ${compact ? "text-xs" : ""} ${d === today ? "outline outline-2 outline-offset-1 outline-teal-500" : ""} ${d < today ? "opacity-60" : ""}`}>
              {dayNum(d)}
              {vehicle.quantityMode === "pool" && c && c.state !== "off" && !compact && <span className="absolute bottom-0.5 text-[9px] font-bold opacity-80">{c.free}/{vehicle.units}</span>}
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-mute">
          {counts.free ?? 0} giorni liberi · {(counts.booked ?? 0) + (counts.partial ?? 0)} con prenotazioni · {counts.off ?? 0} non disponibili
        </p>
      )}
      {sel && <BookingSheet vehicle={vehicle} day={sel} bookings={bookings} onClose={() => setSel(null)} />}
    </div>
  );
}
