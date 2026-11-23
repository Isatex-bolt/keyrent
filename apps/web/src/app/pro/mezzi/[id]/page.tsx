import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proFleet, keepSede as keep } from "@/lib/v2/pro";
import { redirect } from "next/navigation";
import { dayList, monthRange, shiftMonth } from "@/lib/v2/fleet";
import { userDb } from "@/lib/supabase/server";
import { AvailabilityPanel } from "@/components/v2/AvailabilityPanel";
import { LISTING_LABEL, STATE, euroShort, shortDate } from "@/components/v2/ui";
import { canEdit } from "@/lib/auth";

export const metadata = { title: "Scheda mezzo" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-white" />}><Vehicle params={params} searchParams={searchParams} /></Suspense>;
}

const UNIT: Record<string, string> = { hour: "ora", half_day: "mezza giornata", day: "giorno", weekend: "weekend", week: "settimana", month: "mese" };

async function Vehicle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const { mese, from, to } = monthRange(typeof sp.mese === "string" ? sp.mese : undefined);
  const { data, all, membership } = await proFleet(sp, from, to, `/pro/mezzi/${id}`);
  const v = all.vehicles.find((x) => x.id === id);
  if (!v) notFound();
  // una bozza non ha ancora una scheda: si continua a compilarla
  if (v.status === "draft") redirect(`/pro/mezzi/${id}/modifica`);
  // dettagli dell'annuncio vero (sola lettura); per i dati di esempio valori di prova
  let detail = { description: "Mezzo di esempio: descrizione dell'annuncio.", attributes: {} as Record<string, unknown>, prices: [] as { unit: string; price_cents: number }[],
    deposit: 30000, minHours: 24, instant: false, delivery: null as null | { radius: number } };
  {
    const db = await userDb();
    const [{ data: l }, { data: pr }, { data: rt }] = await Promise.all([
      db.from("listings").select("description, attributes, instant_book").eq("id", id).maybeSingle(),
      db.from("pricing_rules").select("unit, price_cents").eq("listing_id", id).order("price_cents"),
      db.from("rental_terms").select("*").eq("listing_id", id).maybeSingle(),
    ]);
    detail = { description: l?.description ?? "", attributes: (l?.attributes ?? {}) as Record<string, unknown>, prices: pr ?? [],
      deposit: rt?.deposit_cents ?? 0, minHours: Math.round((rt?.min_duration_minutes ?? 60) / 60), instant: !!l?.instant_book,
      delivery: rt?.delivery_enabled ? { radius: rt.delivery_radius_km as number } : null };
  }
  const bookings = [...all.bookings, ...all.requests].filter((b) => b.listingId === v.id);
  const future = bookings.filter((b) => b.returnAt >= new Date().toISOString()).sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  const q = keep(sp);
  const href = (m: string) => `/pro/mezzi/${v.id}${keep(sp, { mese: m })}#calendario`;
  const [yy, mm] = mese.split("-").map(Number);
  const months = [shiftMonth(mese, -12), shiftMonth(mese, 12), ...Array.from({ length: 6 }, (_, i) => `${yy}-${String((mm <= 6 ? 1 : 7) + i).padStart(2, "0")}`)];
  const hrefs = Object.fromEntries(months.map((m) => [m, href(m)]));
  const today = v.days[data.today]?.state ?? "off";
  return (
    <div className="space-y-6">
      <Link href={`/pro/mezzi${q}`} className="text-sm text-mute hover:text-navy-900">← I miei mezzi</Link>
      <header className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-navy-50 to-teal-50">
          {v.cover ? <img src={v.cover} alt="" className="h-full w-full object-cover" /> : <Link href={`/pro/mezzi/${v.id}/modifica`} className="grid h-full place-items-center text-xs font-semibold uppercase tracking-[0.2em] text-navy-700/50 hover:text-teal-600">Carica le foto</Link>}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{v.title}</h1>
          <p className="text-mute">{v.category} · {[v.make, v.model].filter(Boolean).join(" ") || "—"} · {v.locationName}{v.quantityMode === "pool" ? ` · ${v.units} unità` : ""}</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-navy-50 px-2.5 py-1">Annuncio: {LISTING_LABEL[v.status] ?? v.status}</span>
            <span className={`rounded-full px-2.5 py-1 ring-1 ${STATE[today].cell}`}>Oggi: {STATE[today].label}</span>
            <span className="rounded-full bg-navy-50 px-2.5 py-1">{future.length} prenotazioni attive/future</span>
          </div>
          {v.alerts.length > 0 && <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{v.alerts.join(" · ")}</p>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Annuncio</h2>
              {canEdit(membership) && <Link href={`/pro/mezzi/${v.id}/modifica`} className="btn-primary px-4 py-2 text-sm">Modifica annuncio</Link>}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-xs text-mute">Descrizione</dt><dd className="whitespace-pre-line">{detail.description || "—"}</dd></div>
              <div><dt className="text-xs text-mute">Prenotazione immediata</dt><dd className="font-medium">{detail.instant ? "Sì" : "No"}</dd></div>
              <div><dt className="text-xs text-mute">Unità</dt><dd className="font-medium">{v.units}</dd></div>
            </dl>
          </div>
          <div className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
            <div>
              <h2 className="mb-2 font-semibold">Prezzi</h2>
              <ul className="space-y-1">{detail.prices.length ? detail.prices.map((p, i) => <li key={i} className="flex justify-between"><span className="text-mute">{UNIT[p.unit] ?? p.unit}</span><b>{euroShort(p.price_cents)}</b></li>) : <li className="text-mute">Nessuna tariffa</li>}</ul>
            </div>
            <div>
              <h2 className="mb-2 font-semibold">Condizioni</h2>
              <ul className="space-y-1">
                <li className="flex justify-between"><span className="text-mute">Cauzione</span><b>{euroShort(detail.deposit)}</b></li>
                <li className="flex justify-between"><span className="text-mute">Durata minima</span><b>{detail.minHours} ore</b></li>
                <li className="flex justify-between"><span className="text-mute">Consegna a domicilio</span><b>{detail.delivery ? `Entro ${detail.delivery.radius} km` : "No"}</b></li>
              </ul>
            </div>
            {Object.keys(detail.attributes).length > 0 && (
              <div className="sm:col-span-2">
                <h2 className="mb-2 font-semibold">Caratteristiche</h2>
                <div className="flex flex-wrap gap-1.5">{Object.entries(detail.attributes).map(([k, val]) => <span key={k} className="rounded-full bg-navy-50 px-2.5 py-1 text-xs">{k}: <b>{String(val)}</b></span>)}</div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div id="prenotazioni" className="card p-5">
            <h2 className="mb-2 font-semibold">Prenotazioni</h2>
            {future.length ? (
              <ul className="divide-y divide-line text-sm">
                {future.map((b) => <li key={b.id} className="py-2"><b>{b.customer}</b> · {b.code}<br /><span className="text-xs text-mute">{shortDate(b.pickupAt)} → {shortDate(b.returnAt)} · {euroShort(b.totalCents)}</span></li>)}
              </ul>
            ) : <p className="text-sm text-mute">Nessuna prenotazione in arrivo.</p>}
          </div>
        </div>
      </div>
      <div id="calendario">
        <AvailabilityPanel vehicle={v} days={dayList(from, to)} bookings={bookings} today={data.today} mese={mese} hrefFor={hrefs} />
      </div>
    </div>
  );
}
