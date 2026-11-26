import { expireAll } from "@/lib/payments";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge } from "@/lib/status";
import { bookingStatus, fmtDateTime } from "@/lib/bookings";
import { euro } from "@/lib/format";
import { listingHref } from "@/lib/urls";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { cancelMyBooking } from "../../bookingActions";

export const metadata = { title: "La mia prenotazione" };

export default function Page({ params, searchParams }: PageProps<"/account/prenotazioni/[id]">) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><Detail params={params} searchParams={searchParams} /></Suspense></div>;
}

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/account/prenotazioni/${id}`);
  await expireAll();
  const db = await userDb();
  const [{ data: rows }, { data: identity }, { data: pickup }, { data: events }] = await Promise.all([
    db.rpc("my_bookings", { p_booking: id }),
    db.rpc("get_booking_provider_identity", { p_booking: id }),
    db.rpc("get_booking_pickup_details", { p_booking: id }),
    db.from("booking_events").select("to_status, created_at, reason").eq("booking_id", id).order("created_at"),
  ]);
  const { data: pay } = await db.from("bookings").select("payment_required, payment_ready").eq("id", id).maybeSingle();
  const { data: pend } = await db.from("bookings").select("id").eq("id", id).not("capture_pending_since", "is", null).maybeSingle();
  const verifying = !!pend;
  const b = rows?.[0];
  if (!b) notFound();
  await db.rpc("mark_booking_updates_seen", { p_booking: id, p_as: "customer" });
  const canCancel = ["requested", "accepted", "confirmed"].includes(b.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm text-mute hover:text-navy-900">← Il mio account</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{b.listing_title}</h1>
          <Badge map={bookingStatus} value={verifying ? "verifying" : b.status} />
        </div>
        <p className="text-sm text-mute">Prenotazione {b.code} · {b.city} ({b.province})</p>
      </div>
      <Flash sp={sp} ok={{ richiesta: pay?.payment_required
        ? "Richiesta inviata! L'importo è bloccato sulla carta: lo addebitiamo solo se il noleggiatore accetta (entro 24 ore)."
        : "Richiesta inviata! Il noleggiatore ha 24 ore per rispondere: ti avvisiamo appena lo fa.", cancellata: "Prenotazione cancellata." }} />

      <section className="card grid gap-4 p-5 text-sm sm:grid-cols-3">
        <div><p className="text-mute">Ritiro</p><p className="font-semibold">{fmtDateTime(b.pickup_at)}</p></div>
        <div><p className="text-mute">Riconsegna</p><p className="font-semibold">{fmtDateTime(b.return_at)}</p></div>
        <div><p className="text-mute">Totale noleggio</p><p className="text-lg font-bold">{euro(b.total_cents)}</p>
          {b.deposit_cents > 0 && <p className="text-xs text-mute">+ cauzione {euro(b.deposit_cents)} al ritiro</p>}</div>
      </section>

      {b.status === "requested" && pay?.payment_required && !pay.payment_ready ? (
        <section className="card space-y-3 border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold">Completa il pagamento</h2>
          <p className="text-sm">La richiesta parte quando inserisci la carta. Teniamo le date bloccate per 30 minuti.</p>
          <Link href={`/account/prenotazioni/${b.id}/pagamento`} className="btn-primary w-full">Inserisci la carta</Link>
        </section>
      ) : b.status === "requested" && b.provider_response_due_at && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm">
          In attesa della risposta del noleggiatore, entro {fmtDateTime(b.provider_response_due_at)}.
          {pay?.payment_ready && " L'importo è bloccato sulla carta: viene addebitato solo se accetta, altrimenti il blocco si annulla."}
        </p>
      )}

      {identity && (
        <section className="card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Il noleggiatore</h2>
          <p>{identity.legal_name}{identity.trade_name ? ` (${identity.trade_name})` : ""} · P.IVA {identity.vat_number}</p>
          {identity.legal_address?.city && <p className="text-mute">Sede legale: {[identity.legal_address.street, identity.legal_address.city, identity.legal_address.province].filter(Boolean).join(", ")}</p>}
        </section>
      )}

      {verifying && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm">
          Il noleggiatore ha accettato e stiamo verificando l&apos;addebito con la banca. Le date restano bloccate per te:
          ti avvisiamo appena è confermato. Non serve fare nulla e non verrà addebitato due volte.
        </p>
      )}

      {b.status === "accepted" && !verifying && !pay?.payment_required && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Conferma e paga</h2>
          <p className="text-sm">Il noleggiatore ha accettato. {b.customer_confirm_due_at ? `Hai tempo fino a ${fmtDateTime(b.customer_confirm_due_at)} per confermare.` : ""}</p>
          <button disabled className="btn-primary w-full cursor-not-allowed opacity-50">Conferma e paga {euro(b.total_cents)}</button>
          <p className="text-xs text-mute">Il pagamento online è in attivazione: per ora questo passaggio non è disponibile. Nessun addebito è stato effettuato.</p>
        </section>
      )}

      {pickup ? (
        <section className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Ritiro</h2>
          <p className="font-medium">{pickup.trade_name}</p>
          <p>{pickup.address}, {pickup.postal_code} {pickup.city} ({pickup.province})</p>
          {pickup.phone && <p>Telefono: {pickup.phone}</p>}
          {pickup.instructions && <p className="whitespace-pre-line text-mute">{pickup.instructions}</p>}
        </section>
      ) : ["requested", "accepted"].includes(b.status) && (
        <p className="text-sm text-mute">Indirizzo esatto, telefono e istruzioni per il ritiro compaiono qui dopo la conferma e il pagamento.</p>
      )}

      <section className="card p-5 text-sm">
        <h2 className="mb-2 font-semibold">Cronologia</h2>
        <ul className="space-y-1">
          {(events ?? []).map((e, i) => <li key={i} className="flex justify-between gap-4"><span>{bookingStatus[e.to_status]?.label ?? e.to_status}{e.reason ? ` — ${e.reason}` : ""}</span><span className="text-mute">{fmtDateTime(e.created_at)}</span></li>)}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={`/messaggi/nuovo?annuncio=${b.listing_id}`} className="btn-ghost">Scrivi al noleggiatore</Link>
        <Link href={listingHref({ id: b.listing_id, slug: b.listing_slug })} className="btn-ghost">Vedi l&apos;annuncio</Link>
      </div>

      {canCancel && (
        <details className="card p-5 text-sm">
          <summary className="cursor-pointer font-semibold text-red-700">Cancella prenotazione</summary>
          <form action={cancelMyBooking} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={b.id} />
            <p className="text-mute">{b.status === "confirmed" ? "Si applica la policy di cancellazione che hai accettato." : "Prima della conferma la cancellazione è gratuita."}</p>
            <input name="reason" className="field" placeholder="Motivo (facoltativo)" />
            <button className="btn-ghost text-red-700">Conferma cancellazione</button>
          </form>
        </details>
      )}
    </div>
  );
}
