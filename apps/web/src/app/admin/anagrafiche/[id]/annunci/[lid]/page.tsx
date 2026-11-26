import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { Badge, listingStatus } from "@/lib/status";
import { priceUnitLabel } from "@/lib/format";
import { listingHref } from "@/lib/urls";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { DeliveryFields } from "@/components/DeliveryFields";
import { staffSetSelect, staffSubmitListing, staffUpdateDelivery, staffUpdateDetails, staffUpdateModes, staffUpdatePrices } from "@/app/admin/listingActions";
import { LongTermFields } from "@/components/LongTermFields";

export const metadata = { title: "Modifica annuncio del noleggiatore" };

export default function Page({ params, searchParams }: PageProps<"/admin/anagrafiche/[id]/annunci/[lid]">) {
  return <Suspense fallback={<Skeleton />}><Edit params={params} searchParams={searchParams} /></Suspense>;
}

async function Edit({ params, searchParams }: { params: Promise<{ id: string; lid: string }>; searchParams: SP }) {
  const { id, lid } = await params;
  const sp = await searchParams;
  await requireStaff();
  const db = serviceDb();
  const [{ data: l }, { data: prices }, { data: terms }] = await Promise.all([
    db.from("listings").select("id, slug, title, description, status, organization_id, organizations(legal_name, trade_name)").eq("id", lid).eq("organization_id", id).maybeSingle(),
    db.from("pricing_rules").select("unit, price_cents, valid_from").eq("listing_id", lid),
    db.from("rental_terms").select("*").eq("listing_id", lid).maybeSingle(),
  ]);
  if (!l) notFound();
  // a parte: se il database non è ancora aggiornato (0030) la pagina funziona lo stesso
  const { data: selRow } = await db.from("listings").select("is_select").eq("id", lid).maybeSingle();
  const isSelect = !!(selRow as { is_select?: boolean } | null)?.is_select;
  const org = l.organizations as unknown as { legal_name: string; trade_name: string | null } | null;
  const base = (u: string) => (prices ?? []).find((p) => p.unit === u && !p.valid_from)?.price_cents;
  const draftLike = ["draft", "changes_required"].includes(l.status);
  return (
    <div className="max-w-3xl space-y-5">
      <Link href={`/admin/anagrafiche/${id}`} className="text-sm text-mute hover:text-navy-900">← {org?.trade_name ?? org?.legal_name}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ProHeader title={l.title} subtitle="Modifica per conto del noleggiatore: le modifiche del team valgono subito e restano nel registro attività." />
        <Badge map={listingStatus} value={l.status} />
      </div>
      <Flash sp={sp} ok={{ creato: "Bozza creata per il noleggiatore: completa foto e dettagli, poi inviala in revisione.", salvato: "Modifiche salvate.", prezzi: "Prezzi aggiornati." }} />
      {draftLike && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-mute">Quando l&apos;annuncio è completo (descrizione, prezzo, foto) invialo in revisione e approvalo da &quot;Revisione annunci&quot;.</p>
          <form action={staffSubmitListing}><input type="hidden" name="id" value={lid} /><button className="btn-primary">Invia in revisione</button></form>
        </div>
      )}
      {l.status === "published" && <Link href={listingHref({ id: lid, slug: l.slug })} className="text-sm font-semibold text-teal-600">Vedi l&apos;annuncio online →</Link>}

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">KeyRent Select</h2>
          <p className="text-sm text-mute">{isSelect ? "Questo annuncio è nella sezione Select: non compare nella ricerca normale, solo nell'invito Select." : "Annuncio normale. Mettilo in Select se è un mezzo esclusivo (supercar, lusso…)."}</p>
        </div>
        <form action={staffSetSelect}>
          <input type="hidden" name="id" value={lid} /><input type="hidden" name="org" value={id} />
          <input type="hidden" name="select" value={isSelect ? "0" : "1"} />
          <button className={isSelect ? "rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-amber-300" : "btn-ghost"}>{isSelect ? "✦ In Select · togli" : "Metti in Select"}</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Titolo e descrizione</h2>
        <form action={staffUpdateDetails} className="space-y-3">
          <input type="hidden" name="id" value={lid} />
          <div><label className="label" htmlFor="title">Titolo</label><input id="title" name="title" required defaultValue={l.title} className="field" /></div>
          <div><label className="label" htmlFor="description">Descrizione</label><textarea id="description" name="description" rows={5} defaultValue={l.description ?? ""} className="field" /></div>
          <button className="btn-primary">Salva</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Prezzi</h2>
        <form action={staffUpdatePrices} className="space-y-3">
          <input type="hidden" name="id" value={lid} />
          <div className="grid gap-3 sm:grid-cols-4">
            {(["day", "week", "half_day", "hour"] as const).map((u) => (
              <div key={u}><label className="label" htmlFor={`price_${u}`}>{priceUnitLabel[u]} (€)</label>
                <input id={`price_${u}`} name={`price_${u}`} type="number" min={0} step="0.01" defaultValue={base(u) ? base(u)! / 100 : ""} className="field" /></div>
            ))}
          </div>
          <button className="btn-primary">Salva prezzi</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Breve e lungo termine</h2>
        <form action={staffUpdateModes} className="space-y-3">
          <input type="hidden" name="id" value={lid} />
          <LongTermFields initial={terms ?? undefined} />
          <button className="btn-primary">Salva</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Consegna a domicilio</h2>
        <form action={staffUpdateDelivery} className="space-y-3">
          <input type="hidden" name="id" value={lid} />
          <DeliveryFields initial={{ enabled: !!terms?.delivery_enabled, radius: terms?.delivery_radius_km ?? null, fee: terms?.delivery_fee_cents ?? 0, perKm: terms?.delivery_per_km_cents ?? 0 }} />
          <button className="btn-primary">Salva consegna</button>
        </form>
      </section>
      <p className="text-xs text-mute">Foto e caratteristiche le gestisce il noleggiatore dalla sua area (o le aggiungi tu entrando con lui al telefono).</p>
    </div>
  );
}
