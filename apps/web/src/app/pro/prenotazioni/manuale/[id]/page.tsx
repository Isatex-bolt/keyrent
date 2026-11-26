import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { SubmitOnce } from "@/components/SubmitOnce";
import { ManualForm } from "../ManualForm";
import { cancelManual, updateManual } from "../actions";
import { orgVehicles, romeParts } from "../data";

export const metadata = { title: "Prenotazione manuale" };

export default function Page({ params, searchParams }: PageProps<"/pro/prenotazioni/manuale/[id]">) {
  return <Suspense fallback={<Skeleton />}><Edit params={params} searchParams={searchParams} /></Suspense>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { membership } = await requireProvider("/pro/prenotazioni");
  if (!membership) redirect("/pro");
  const db = await userDb();
  const { data: m } = await db.from("manual_bookings")
    .select("id, code, listing_id, customer_name, customer_contact, pickup_at, return_at, price_cents, note, status, organization_id")
    .eq("id", id).maybeSingle();
  if (!m || m.organization_id !== membership.organization_id) notFound();
  const back = one(sp.back).startsWith("/pro") ? one(sp.back) : "/pro/prenotazioni";
  const [dal, oraR] = romeParts(m.pickup_at), [al, oraC] = romeParts(m.return_at);
  const vehicles = await orgVehicles(membership.organization_id);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ProHeader title={`Prenotazione manuale ${m.code}`} subtitle={m.status === "cancelled" ? "Annullata: il mezzo è libero." : "Modifica date, mezzo, cliente o prezzo."} />
      <Flash sp={sp} />
      {m.status === "active" ? (
        <>
          <ManualForm action={updateManual} back={back} vehicles={vehicles} submit="Salva modifiche"
            values={{ id: m.id, mezzo: m.listing_id, dal, al, ora_ritiro: oraR, ora_riconsegna: oraC, nome: m.customer_name,
              recapito: m.customer_contact ?? "", prezzo: m.price_cents ? String(m.price_cents / 100).replace(".", ",") : "", note: m.note ?? "" }} />
          <form action={cancelManual} className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
            <p className="text-sm text-mute">Il cliente ha disdetto? Annulla la prenotazione: il mezzo torna subito disponibile.</p>
            <SubmitOnce className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50" pendingText="Annullo…">Annulla prenotazione</SubmitOnce>
          </form>
        </>
      ) : <p className="card p-6 text-mute">{m.customer_name} · annullata.</p>}
    </div>
  );
}
