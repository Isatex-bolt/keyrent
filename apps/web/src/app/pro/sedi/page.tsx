import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider, canEdit } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { PLACES } from "@/lib/places";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { createLocation, toggleLocation } from "../actions";

export const metadata = { title: "Le mie sedi" };

export default function Page({ searchParams }: PageProps<"/pro/sedi">) {
  return <Suspense fallback={<Skeleton />}><Sedi searchParams={searchParams} /></Suspense>;
}

async function Sedi({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/sedi");
  if (!membership) redirect("/pro");
  const db = await userDb();
  const { data: sedi } = await db.from("locations").select("id, name, address_line, postal_code, city, province, phone, active").order("created_at");
  return (
    <div className="space-y-6">
      <ProHeader title="Le mie sedi" subtitle="Indirizzo, telefono e istruzioni restano riservati: il cliente li vede solo a prenotazione pagata." />
      <Flash sp={sp} ok={{ "1": "Sede aggiunta." }} />
      {sp.benvenuto && <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm">Attività registrata. Ora aggiungi almeno una sede di ritiro.</p>}
      <ul className="space-y-3">
        {(sedi ?? []).map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{s.name} {!s.active && <span className="ml-2 text-xs font-normal text-mute">(disattivata)</span>}</p>
              <p className="text-sm text-mute">{s.address_line}, {s.postal_code} {s.city} ({s.province}){s.phone ? ` · ${s.phone}` : ""}</p>
            </div>
            {canEdit(membership) && (
              <form action={toggleLocation}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} />
                <button className="btn-ghost">{s.active ? "Disattiva" : "Riattiva"}</button>
              </form>
            )}
          </li>
        ))}
        {!sedi?.length && <li className="card p-6 text-sm text-mute">Nessuna sede ancora.</li>}
      </ul>
      {canEdit(membership) && (
        <form action={createLocation} className="card space-y-4 p-6">
          <h2 className="font-semibold">Aggiungi sede</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Nome sede</label><input id="name" name="name" placeholder="Es. Sede Padova" className="field" /></div>
            <div><label className="label" htmlFor="city">Città</label>
              <select id="city" name="city" required className="field" defaultValue="">
                <option value="" disabled>Scegli…</option>
                {PLACES.map((p) => <option key={p.slug} value={p.name}>{p.name} ({p.province})</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="label" htmlFor="address_line">Indirizzo</label><input id="address_line" name="address_line" required className="field" /></div>
            <div><label className="label" htmlFor="postal_code">CAP</label><input id="postal_code" name="postal_code" required className="field" /></div>
            <div><label className="label" htmlFor="phone">Telefono sede</label><input id="phone" name="phone" type="tel" className="field" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="pickup_instructions">Istruzioni per il ritiro</label>
              <textarea id="pickup_instructions" name="pickup_instructions" rows={3} className="field" placeholder="Es. citofono, orari, dove parcheggiare" /></div>
          </div>
          <p className="text-xs text-mute">La città non è nell&apos;elenco? Scrivici: aggiungiamo la località.</p>
          <button className="btn-primary">Aggiungi sede</button>
        </form>
      )}
    </div>
  );
}
