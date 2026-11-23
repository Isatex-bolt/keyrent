import { Suspense } from "react";
import Link from "next/link";
import { previewFleet, keep } from "@/lib/v2/context";
import { dayList, isoDay, type FleetBooking } from "@/lib/v2/fleet";
import { ProviderShellV2 } from "@/components/v2/Shell";
import { FleetTimeline } from "@/components/v2/FleetTimeline";
import { DemoNote, Kpi, Legend, euroShort, shortDate } from "@/components/v2/ui";

export const metadata = { title: "Dashboard V2 · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-white" />}><Dashboard searchParams={searchParams} /></Suspense>;
}

const plus = (d: string, n: number) => isoDay(new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000));

async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = isoDay(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = plus(`${plus(monthStart, 32).slice(0, 7)}-01`, -1);
  const to = plus(today, 14) > monthEnd ? plus(today, 14) : monthEnd;
  const { data, all, sede, reason } = await previewFleet(sp, monthStart, to);
  const now = new Date().toISOString();
  const live = ["confirmed", "picked_up", "completed"];
  const month = data.bookings.filter((b) => live.includes(b.status) && b.pickupAt.slice(0, 7) === today.slice(0, 7));
  const gross = month.reduce((s, b) => s + b.totalCents, 0), net = month.reduce((s, b) => s + b.netCents, 0);
  const futureNet = data.bookings.filter((b) => b.status === "confirmed" && b.pickupAt > now).reduce((s, b) => s + b.netCents, 0);
  const active = data.bookings.filter((b) => b.status === "picked_up" || (b.status === "confirmed" && b.pickupAt <= now && b.returnAt >= now));
  const st = (s: string) => data.vehicles.filter((v) => (v.days[today]?.state ?? "off") === s).length;
  const free = st("free") + st("partial"), busy = st("booked") + st("pending"), off = st("off");
  const monthDays = dayList(monthStart, monthEnd);
  let used = 0, cap = 0;
  for (const v of data.vehicles) for (const d of monthDays) {
    const c = v.days[d]; if (!c || c.state === "off") continue;
    cap += 1; used += c.state === "booked" ? 1 : c.state === "partial" ? 1 - c.free / Math.max(1, v.units) : 0;
  }
  const util = cap ? Math.round((used / cap) * 100) : 0;
  const pickupsToday = data.bookings.filter((b) => b.pickupAt.slice(0, 10) === today && b.status !== "completed");
  const returnsToday = data.bookings.filter((b) => b.returnAt.slice(0, 10) === today);
  const week = plus(today, 7);
  const nextEvents = [
    ...data.bookings.filter((b) => b.pickupAt.slice(0, 10) > today && b.pickupAt.slice(0, 10) <= week).map((b) => ({ b, kind: "Ritiro" as const, at: b.pickupAt })),
    ...data.bookings.filter((b) => b.returnAt.slice(0, 10) > today && b.returnAt.slice(0, 10) <= week).map((b) => ({ b, kind: "Rientro" as const, at: b.returnAt })),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 8);
  const title = (b: FleetBooking) => data.vehicles.find((v) => v.id === b.listingId)?.title ?? "Mezzo";
  const daily = monthDays.map((d) => month.filter((b) => b.pickupAt.slice(0, 10) === d).reduce((s, b) => s + b.netCents, 0));
  const maxDaily = Math.max(1, ...daily);
  const q = keep(sp);
  const dateLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date());

  return (
    <ProviderShellV2 orgName={all.orgName} locations={all.locations} sede={sede}>
      {reason && <DemoNote reason={reason} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm capitalize text-mute">{dateLabel}</p>
          <h1 className="text-3xl font-bold tracking-tight">Panoramica di oggi</h1>
          <p className="text-mute">Richieste, ritiri, rientri e disponibilità della flotta.</p>
        </div>
        <Link href={`/preview/provider-fleet-v2${q}`} className="btn-ghost">I miei mezzi →</Link>
      </header>

      <section className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        <Kpi label="Richieste da approvare" value={data.requests.length} tone={data.requests.length ? "alert" : "default"} hint={data.requests.length ? "Rispondi entro 24 ore" : "Tutto in ordine"} />
        <Kpi label="Ricavi del mese (netto)" value={euroShort(net)} hint={`${euroShort(gross)} lordo`} tone="good" />
        <Kpi label="Prenotazioni del mese" value={month.length} />
        <Kpi label="Noleggi attivi" value={active.length} />
        <Kpi label="Disponibili oggi" value={free} hint={`su ${data.vehicles.length} mezzi`} />
        <Kpi label="Occupati oggi" value={busy} />
        <Kpi label="Mezzi pubblicati" value={data.vehicles.filter((v) => v.status === "published").length} />
        <Kpi label="Utilizzo flotta (mese)" value={`${util}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Oggi</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <EventList title="Ritiri previsti" empty="Nessun ritiro oggi" items={pickupsToday.map((b) => ({ b, at: b.pickupAt }))} name={title} />
            <EventList title="Riconsegne previste" empty="Nessuna riconsegna oggi" items={returnsToday.map((b) => ({ b, at: b.returnAt }))} name={title} />
          </div>
          {data.requests.length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-amber-950">{data.requests.length} {data.requests.length === 1 ? "richiesta da confermare" : "richieste da confermare"}</p>
                <Link href="/pro/richieste" className="text-sm font-semibold text-amber-900 underline">Rispondi</Link>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-950">
                {data.requests.slice(0, 3).map((b) => <li key={b.id}>{title(b)} · {b.customer} · {shortDate(b.pickupAt)}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Flotta oggi</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            <span className="bg-emerald-500 transition-all" style={{ width: `${(free / Math.max(1, data.vehicles.length)) * 100}%` }} />
            <span className="bg-red-500 transition-all" style={{ width: `${(busy / Math.max(1, data.vehicles.length)) * 100}%` }} />
            <span className="bg-slate-400 transition-all" style={{ width: `${(off / Math.max(1, data.vehicles.length)) * 100}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-mute">Disponibili</dt><dd className="text-xl font-bold text-emerald-700">{free}</dd></div>
            <div><dt className="text-mute">Occupati</dt><dd className="text-xl font-bold text-red-600">{busy}</dd></div>
            <div><dt className="text-mute">Non disponibili</dt><dd className="text-xl font-bold text-slate-500">{off}</dd></div>
            <div><dt className="text-mute">Totale mezzi</dt><dd className="text-xl font-bold">{data.vehicles.length}</dd></div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Prossimi 7 giorni</h2>
          {nextEvents.length ? (
            <ul className="divide-y divide-line">
              {nextEvents.map(({ b, kind, at }) => (
                <li key={`${b.id}${kind}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${kind === "Ritiro" ? "bg-teal-50 text-teal-600" : "bg-navy-50 text-navy-800"}`}>{kind}</span>
                  <span className="min-w-0 flex-1 truncate"><b>{title(b)}</b> · {b.customer}</span>
                  <span className="shrink-0 text-xs text-mute">{shortDate(at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-mute">Nessun ritiro o rientro nei prossimi 7 giorni.</p>}
        </div>
        <div className="card p-5">
          <h2 className="mb-1 font-semibold">Ricavi</h2>
          <p className="text-3xl font-bold tracking-tight">{euroShort(net)}</p>
          <p className="text-xs text-mute">netto del mese · {euroShort(gross)} lordo</p>
          <div className="mt-4 flex h-16 items-end gap-[2px]" aria-label="Netto per giorno di ritiro">
            {daily.map((v, i) => <span key={i} className={`flex-1 rounded-t ${monthDays[i] === today ? "bg-teal-500" : "bg-navy-100"}`} style={{ height: `${Math.max(4, (v / maxDaily) * 100)}%` }} />)}
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Netto previsto (prenotazioni future)</dt><dd className="font-semibold">{euroShort(futureNet)}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">Pagamenti in arrivo</dt><dd className="font-semibold">{euroShort(data.payoutsCents)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold">Disponibilità · prossimi 14 giorni</h2>
          <Link href={`/preview/provider-calendar-v2${q}`} className="text-sm font-semibold text-teal-600">Calendario completo →</Link>
        </div>
        <Legend pool={data.vehicles.some((v) => v.quantityMode === "pool")} />
        <FleetTimeline vehicles={data.vehicles} days={dayList(today, plus(today, 13))} bookings={[...data.bookings, ...data.requests]} today={today}
          vehicleBase="/preview/provider-vehicle-v2" qs={q} />
      </section>
    </ProviderShellV2>
  );
}

function EventList({ title, empty, items, name }: { title: string; empty: string; items: { b: FleetBooking; at: string }[]; name: (b: FleetBooking) => string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map(({ b, at }) => (
            <li key={b.id} className="text-sm"><b>{name(b)}</b><br /><span className="text-mute">{b.customer} · {new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(at))}</span></li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-mute">{empty}</p>}
    </div>
  );
}
