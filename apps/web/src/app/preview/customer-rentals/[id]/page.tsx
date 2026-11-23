import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCustomer } from "@/lib/v2/customer";
import { userDb } from "@/lib/supabase/server";
import { STATUS, Thumb, eur, hour, qs, relDay, when } from "@/components/v2/customer/ui";
import { Countdown } from "@/components/v2/customer/Countdown";

export const metadata = { title: "Noleggio · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Detail params={params} searchParams={searchParams} /></Suspense>;
}

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await loadCustomer(sp);
  const r = c.rentals.find((x) => x.id === id);
  if (!r) notFound();
  // dopo il pagamento: indirizzo, telefono e istruzioni (stesse regole di oggi)
  const canSee = ["attivi", "futuri", "completati"].includes(r.bucket);
  let pickup = c.demo && canSee ? { trade_name: "Rent Padova Srl", address: "Via Venezia 12", postal_code: "35131", city: r.city, province: r.province, phone: "+39 049 123 4567", instructions: "Citofono Rent Padova, parcheggio interno." } : null;
  if (!c.demo && canSee) { const { data } = await (await userDb()).rpc("get_booking_pickup_details", { p_booking: id }); pickup = data ?? null; }
  const s = STATUS[r.status] ?? { label: r.status, tone: "" };
  const live = r.bucket === "attivi";
  const maps = pickup ? `https://maps.apple.com/?q=${encodeURIComponent(`${pickup.address}, ${pickup.city}`)}` : null;
  return (
    <div className="mx-auto max-w-md space-y-4 pb-24">
      <Link href={`/preview/customer-rentals${qs(sp)}`} className="text-sm text-mute">← I miei noleggi</Link>
      <div className="flex items-center gap-3">
        <Thumb r={r} className="h-20 w-20" />
        <div className="min-w-0">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}>{s.label}</span>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{r.title}</h1>
          <p className="text-sm text-mute">{r.category} · {r.city} · {r.code}</p>
        </div>
      </div>

      {live && (
        <div className="rounded-3xl bg-navy-900 p-5 text-white">
          <p className="text-sm text-white/70">Riconsegna</p>
          <p className="text-3xl font-bold tracking-tight">{relDay(r.returnAt)}, {hour(r.returnAt)}</p>
          <Countdown to={r.returnAt} label="mancano" className="mt-1 text-sm text-teal-400" />
        </div>
      )}
      {r.status === "requested" && (
        <div className="rounded-3xl bg-amber-50 p-5">
          <p className="font-semibold text-amber-950">Richiesta inviata</p>
          <p className="mt-1 text-sm text-amber-900">In attesa di conferma del noleggiatore. L&apos;importo è solo bloccato sulla carta: lo addebitiamo se accetta.</p>
          {r.dueAt && <Countdown to={r.dueAt} label="Risposta entro" className="mt-3 text-sm font-semibold text-amber-950" />}
        </div>
      )}

      <div className="card divide-y divide-line">
        <Row k="Ritiro" v={when(r.pickupAt)} />
        <Row k="Riconsegna" v={when(r.returnAt)} />
        <Row k="Totale" v={eur(r.totalCents)} />
      </div>

      {pickup ? (
        <div className="card space-y-3 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-mute">Dove ritirare</p>
          <div><p className="font-semibold">{pickup.trade_name}</p><p className="text-sm">{pickup.address}, {pickup.postal_code} {pickup.city} ({pickup.province})</p></div>
          {pickup.instructions && <p className="text-sm text-mute">{pickup.instructions}</p>}
          <div className="grid grid-cols-2 gap-2">
            {maps && <a href={maps} className="btn-ghost">Apri in Mappe</a>}
            {pickup.phone && <a href={`tel:${pickup.phone.replace(/\s/g, "")}`} className="btn-ghost">Chiama</a>}
          </div>
        </div>
      ) : r.bucket === "attesa" && (
        <p className="rounded-2xl bg-navy-50 p-4 text-sm text-mute">Indirizzo, telefono e istruzioni per il ritiro compaiono qui quando la prenotazione è confermata.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/preview/customer-messages${qs(sp)}`} className="btn-ghost">Scrivi al noleggiatore</Link>
        <Link href="/assistenza" className="btn-ghost">Assistenza</Link>
      </div>
      <p className="text-center text-xs text-mute">Condizioni e cancellazione: come nella pagina attuale della prenotazione.</p>

      {/* azione principale sempre a portata di pollice */}
      <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto max-w-md">
          {r.status === "requested"
            ? <button disabled className="w-full rounded-xl border border-red-200 bg-white py-3.5 font-semibold text-red-700">Annulla richiesta</button>
            : live && maps ? <a href={maps} className="btn-primary w-full py-3.5">Indicazioni per la riconsegna</a>
            : <Link href={`/preview/customer-search${qs(sp)}`} className="btn-primary w-full py-3.5">Prenota di nuovo</Link>}
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between px-4 py-3 text-sm"><span className="text-mute">{k}</span><span className="font-semibold">{v}</span></div>;
