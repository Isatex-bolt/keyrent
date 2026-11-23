import { Suspense } from "react";
import Link from "next/link";
import { proFleet, keepSede as keep } from "@/lib/v2/pro";
import { dayList, monthRange, shiftMonth } from "@/lib/v2/fleet";
import { SedeChips } from "@/components/v2/SedeChips";
import { FleetTimeline } from "@/components/v2/FleetTimeline";
import { AvailabilityPanel } from "@/components/v2/AvailabilityPanel";
import { Legend, monthLabel } from "@/components/v2/ui";

export const metadata = { title: "Calendario" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-white" />}><Calendar searchParams={searchParams} /></Suspense>;
}

async function Calendar({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { mese, from, to } = monthRange(typeof sp.mese === "string" ? sp.mese : undefined);
  const vista = sp.vista === "mezzo" ? "mezzo" : "flotta";
  const { data, all, sede } = await proFleet(sp, from, to, "/pro/calendario");
  const days = dayList(from, to);
  const mezzo = data.vehicles.find((v) => v.id === sp.mezzo) ?? data.vehicles[0];
  const href = (extra: Record<string, string>) => `/pro/calendario${keep(sp, { vista, mese, ...(mezzo ? { mezzo: mezzo.id } : {}), ...extra })}`;
  const bookings = [...data.bookings, ...data.requests];
  return (
    <div className="space-y-6">
      <SedeChips locations={all.locations} sede={sede} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendario</h1>
          <p className="text-mute">Tocca un giorno per vedere la prenotazione.</p>
        </div>
        <div className="flex rounded-xl border border-line bg-white p-1">
          {[["flotta", "Tutta la flotta"], ["mezzo", "Singolo mezzo"]].map(([k, l]) => (
            <Link key={k} href={href({ vista: k })} scroll={false} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${vista === k ? "bg-navy-900 text-white" : "text-mute hover:text-navy-900"}`}>{l}</Link>
          ))}
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link scroll={false} href={href({ mese: shiftMonth(mese, -1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white hover:bg-navy-50" aria-label="Mese precedente">‹</Link>
          <p className="min-w-40 text-center text-lg font-semibold capitalize">{monthLabel(mese)}</p>
          <Link scroll={false} href={href({ mese: shiftMonth(mese, 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white hover:bg-navy-50" aria-label="Mese successivo">›</Link>
        </div>
        <Legend pool={data.vehicles.some((v) => v.quantityMode === "pool")} />
      </div>

      {vista === "flotta" ? (
        <div key={mese} className="animate-[fadeIn_.25s_ease-out]">
          <FleetTimeline vehicles={data.vehicles} days={days} bookings={bookings} today={data.today} vehicleBase="/pro/mezzi" qs={keep(sp)} />
        </div>
      ) : mezzo ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {data.vehicles.map((v) => (
              <Link key={v.id} scroll={false} href={href({ mezzo: v.id })}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition ${v.id === mezzo.id ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white hover:border-navy-700/30"}`}>
                <span className="block font-semibold">{v.title}</span><span className={`block text-xs ${v.id === mezzo.id ? "text-white/70" : "text-mute"}`}>{v.locationName}</span>
              </Link>
            ))}
          </div>
          <AvailabilityPanel showLegend={false} vehicle={mezzo} days={days} bookings={bookings} today={data.today} mese={mese} hrefFor={Object.fromEntries(
            [shiftMonth(mese, -12), shiftMonth(mese, 12), ...Array.from({ length: 6 }, (_, i) => `${mese.slice(0, 4)}-${String((Number(mese.slice(5)) <= 6 ? 1 : 7) + i).padStart(2, "0")}`)]
              .map((m) => [m, href({ mese: m })]))} />
        </div>
      ) : <p className="text-mute">Nessun mezzo: aggiungine uno da “I miei mezzi”.</p>}
    </div>
  );
}
