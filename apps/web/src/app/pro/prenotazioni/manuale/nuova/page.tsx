import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { ManualForm } from "../ManualForm";
import { createManual } from "../actions";
import { orgVehicles } from "../data";

export const metadata = { title: "Nuova prenotazione manuale" };

export default function Page({ searchParams }: PageProps<"/pro/prenotazioni/manuale/nuova">) {
  return <Suspense fallback={<Skeleton />}><New searchParams={searchParams} /></Suspense>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function New({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/prenotazioni/manuale/nuova");
  if (!membership) redirect("/pro");
  const vehicles = await orgVehicles(membership.organization_id);
  const back = one(sp.back).startsWith("/pro") ? one(sp.back) : "/pro/calendario";
  const dal = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.dal)) ? one(sp.dal) : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ProHeader title="Prenotazione manuale" subtitle="Per i noleggi presi al telefono o al banco: tutto nello stesso calendario." />
      <Flash sp={sp} />
      {!vehicles.length ? <p className="card p-6 text-mute">Prima aggiungi un mezzo nella tua flotta.</p> : (
        <ManualForm action={createManual} back={back} vehicles={vehicles} submit="Salva prenotazione"
          values={{ mezzo: one(sp.mezzo) || vehicles[0].id, dal, al: dal, ora_ritiro: "09:00", ora_riconsegna: "18:00", nome: "", recapito: "", prezzo: "", note: "" }} />
      )}
    </div>
  );
}
