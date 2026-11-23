import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { requireProvider, canEdit } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/supabase/public";
import { Badge, listingStatus } from "@/lib/status";
import { euro, priceUnitLabel } from "@/lib/format";
import { listingHref } from "@/lib/urls";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { PhotoUploader } from "./PhotoUploader";
import { AiPhotoHelper } from "./AiPhotoHelper";
import { settingsFor } from "@/lib/aiImage";
import { deleteDraftListing, deleteMedia, transitionListing, updateDelivery, updateListingDetails, updatePrices } from "../../../actions";
import { DeliveryFields } from "@/components/DeliveryFields";

export const maxDuration = 90;
export const metadata = { title: "Scheda annuncio" };

export default function Page({ params, searchParams }: PageProps<"/pro/mezzi/[id]">) {
  return <Suspense fallback={<Skeleton />}><Scheda params={params} searchParams={searchParams} /></Suspense>;
}

const OK: Record<string, string> = {
  salvato: "Modifiche salvate.", revisione: "Modifica inviata a KeyRent: resta online la versione attuale finché non viene approvata.",
  prezzi: "Prezzi aggiornati.", pending_review: "Annuncio inviato in revisione. Ti avviseremo appena KeyRent lo avrà controllato.",
  unpublished: "Annuncio tolto dalla ricerca.", published: "Annuncio di nuovo online.",
};

async function Scheda({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const { membership } = await requireProvider(`/pro/mezzi/${id}/modifica`);
  if (!membership) redirect("/pro");
  const db = await userDb();
  await db.rpc("mark_listing_notices_seen", { p_listing: id });
  const [{ data: l }, { data: media }, { data: prices }, { data: terms }, { data: revs }, { data: units }] = await Promise.all([
    db.from("listings").select("*, categories(name_it, slug), makes(name), models(name), locations(name, city)").eq("id", id).maybeSingle(),
    db.from("listing_media").select("id, storage_path, moderation_status, sort, is_indicative").eq("listing_id", id).order("sort"),
    db.from("pricing_rules").select("unit, price_cents, valid_from").eq("listing_id", id),
    db.from("rental_terms").select("*").eq("listing_id", id).maybeSingle(),
    db.from("listing_revisions").select("number, status, review_notes, reviewed_at, submitted_at, snapshot").eq("listing_id", id).order("number", { ascending: false }).limit(5),
    db.from("listing_units").select("vehicle_unit_id, vehicle_units(year, custom_make, custom_model)").eq("listing_id", id),
  ]);
  if (!l) notFound();
  const edit = canEdit(membership);
  const editing = typeof sp.modifica === "string" ? sp.modifica : null;
  const draftLike = ["draft", "changes_required"].includes(l.status);
  const lastReview = (revs ?? []).find((r) => r.review_notes && ["changes_required", "rejected"].includes(r.status));
  const pendingChange = (revs ?? []).find((r) => r.status === "pending_review" && r.snapshot?.changes);
  const base = (unit: string) => (prices ?? []).find((p) => p.unit === unit && !p.valid_from)?.price_cents;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/pro/mezzi/${id}`} className="text-sm text-mute hover:text-navy-900">← Scheda mezzo</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{l.title}</h1>
          <p className="text-sm text-mute">{l.categories?.name_it} · {l.locations?.name} ({l.locations?.city}) · {units?.length ?? 0} {units?.length === 1 ? "unità" : "unità identiche"}</p>
        </div>
        <Badge map={listingStatus} value={l.status} />
      </div>
      <Flash sp={sp} ok={OK} />
      {sp.nuovo && <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm">Bozza creata. Ora aggiungi almeno 4 foto, poi clicca <strong>Invia per approvazione</strong>.</p>}
      {lastReview && l.status !== "published" && (
        <div className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <p className="font-semibold">Note di KeyRent</p>
          <ul className="mt-1 list-disc pl-5">{Object.entries(lastReview.review_notes as Record<string, string>).map(([k, v]) => <li key={k}>{v}</li>)}</ul>
        </div>
      )}
      {pendingChange && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Hai una modifica in attesa di revisione. Online resta la versione approvata.</p>}

      {/* Azioni di stato */}
      {edit && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          {draftLike && <StateButton id={id} to="pending_review" label="Invia per approvazione" primary />}
          {l.status === "draft" && (
            <form action={deleteDraftListing} className="ml-auto">
              <input type="hidden" name="id" value={id} />
              <button className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Elimina bozza</button>
            </form>
          )}
          {l.status === "published" && <>
            <Link href={listingHref({ id, slug: l.slug })} className="btn-ghost" target="_blank">Vedi come cliente ↗</Link>
            <StateButton id={id} to="unpublished" label="Togli dalla ricerca" />
          </>}
          {l.status === "unpublished" && <StateButton id={id} to="published" label="Rimetti online" primary />}
          {l.status === "pending_review" && <p className="text-sm text-mute">In revisione da parte di KeyRent: di solito entro 1 giorno lavorativo.</p>}
          {l.status === "rejected" && <p className="text-sm text-mute">Annuncio rifiutato. Per riproporlo crea un nuovo annuncio.</p>}
        </div>
      )}

      {/* Foto */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Foto <span className="text-sm font-normal text-mute">({media?.length ?? 0}, minimo 4)</span></h2>
          {edit && <PhotoUploader listingId={id} />}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(media ?? []).map((m) => (
            <div key={m.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-navy-50">
              <Image src={mediaUrl(m.storage_path)} alt="" fill sizes="25vw" className="object-cover" />
              {m.is_indicative && <span className="absolute bottom-2 left-2 rounded bg-navy-950/70 px-2 py-0.5 text-[11px] text-white">Indicativa (AI)</span>}
              {m.moderation_status === "pending" && l.status === "published" && <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[11px]">In revisione</span>}
              {edit && (
                <form action={deleteMedia} className="absolute right-2 top-2">
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="listing_id" value={id} />
                  <button className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-red-700 shadow">Elimina</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {edit && (
        <AiPhotoHelper
          listingId={id}
          settings={settingsFor(l.categories?.slug ?? "").map(({ key, label }) => ({ key, label }))}
          vehicle={[l.makes?.name ?? (units?.[0] as any)?.vehicle_units?.custom_make, l.models?.name ?? (units?.[0] as any)?.vehicle_units?.custom_model].filter(Boolean).join(" ") || l.title}
          year={(units?.[0] as any)?.vehicle_units?.year ?? null}
        />
      )}

      {/* Dettagli */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Titolo e descrizione</h2>
          {edit && editing !== "dettagli" && <Link href={`?modifica=dettagli`} className="btn-ghost">Modifica</Link>}
        </div>
        {editing === "dettagli" && edit ? (
          <form action={updateListingDetails} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            {!draftLike && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">L&apos;annuncio è {listingStatus[l.status]?.label.toLowerCase()}: la modifica sarà controllata da KeyRent prima di andare online.</p>}
            <div><label className="label" htmlFor="title">Titolo</label><input id="title" name="title" required defaultValue={l.title} className="field" /></div>
            <div><label className="label" htmlFor="description">Descrizione</label><textarea id="description" name="description" rows={6} defaultValue={l.description ?? ""} className="field" /></div>
            <div className="flex gap-2"><button className="btn-primary">Salva modifiche</button><Link href="?" className="btn-ghost">Annulla</Link></div>
          </form>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed">{l.description || <span className="text-mute">Nessuna descrizione.</span>}</p>
        )}
      </section>

      {/* Prezzi */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Prezzi</h2>
          {edit && editing !== "prezzi" && <Link href={`?modifica=prezzi`} className="btn-ghost">Modifica</Link>}
        </div>
        {editing === "prezzi" && edit ? (
          <form action={updatePrices} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-4 sm:grid-cols-4">
              {(["hour", "half_day", "day", "week"] as const).map((u) => (
                <div key={u}><label className="label" htmlFor={`price_${u}`}>{priceUnitLabel[u]} (€)</label>
                  <input id={`price_${u}`} name={`price_${u}`} type="number" min={0} step="0.01" defaultValue={base(u) ? base(u)! / 100 : ""} className="field" /></div>
              ))}
            </div>
            <p className="text-xs text-mute">I prezzi si aggiornano subito, anche su un annuncio pubblicato. Le prenotazioni già fatte mantengono il prezzo concordato.</p>
            <div className="flex gap-2"><button className="btn-primary">Salva prezzi</button><Link href="?" className="btn-ghost">Annulla</Link></div>
          </form>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-4">
            {(["hour", "half_day", "day", "week"] as const).filter((u) => base(u)).map((u) => (
              <li key={u} className="rounded-xl bg-canvas p-3"><p className="text-xs text-mute">{priceUnitLabel[u]}</p><p className="font-semibold">{euro(base(u)!)}</p></li>
            ))}
          </ul>
        )}
      </section>

      {/* Consegna a domicilio: bozza → subito; annuncio online → torna in verifica (resta online la versione attuale) */}
      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Consegna a domicilio</h2>
          {terms?.delivery_enabled
            ? <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-600">Attiva · entro {terms.delivery_radius_km} km</span>
            : <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-mute">Non attiva</span>}
        </div>
        {edit ? (
          <form action={updateDelivery} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <DeliveryFields initial={{ enabled: !!terms?.delivery_enabled, radius: terms?.delivery_radius_km ?? null, fee: terms?.delivery_fee_cents ?? 0, perKm: terms?.delivery_per_km_cents ?? 0 }} />
            {!draftLike && <p className="text-xs text-mute">L&apos;annuncio è online: la modifica torna in verifica dal team KeyRent. Fino all&apos;approvazione resta online la versione attuale.</p>}
            <button className="btn-primary" disabled={!!pendingChange && !draftLike}>{draftLike ? "Salva consegna" : "Invia in verifica"}</button>
            {!!pendingChange && !draftLike && <p className="text-xs text-amber-900">C&apos;è già una modifica in verifica: potrai inviarne un&apos;altra dopo la risposta del team.</p>}
          </form>
        ) : terms?.delivery_enabled ? (
          <p className="text-sm text-mute">Entro {terms.delivery_radius_km} km dalla sede · {euro(terms.delivery_fee_cents)} + {euro(terms.delivery_per_km_cents, true)}/km</p>
        ) : null}
      </section>

      {/* Caratteristiche e condizioni (sola lettura per ora) */}
      <section className="card p-5 text-sm">
        <h2 className="mb-3 font-semibold">Caratteristiche e condizioni</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[l.makes?.name ?? null, l.models?.name ?? null].some(Boolean) && <Item k="Marca e modello" v={[l.makes?.name, l.models?.name].filter(Boolean).join(" ")} />}
          {Object.entries(l.attributes ?? {}).map(([k, v]) => <Item key={k} k={k.replaceAll("_", " ")} v={typeof v === "boolean" ? (v ? "Sì" : "No") : String(v)} />)}
          <Item k="Cauzione" v={terms?.deposit_cents ? euro(terms.deposit_cents) : "Nessuna"} />
          {terms?.min_driver_age && <Item k="Età minima" v={`${terms.min_driver_age} anni`} />}
          {terms?.included_km_per_day && <Item k="Km inclusi" v={`${terms.included_km_per_day} al giorno`} />}
        </dl>
        <p className="mt-3 text-xs text-mute">Per cambiare caratteristiche o condizioni di un annuncio pubblicato scrivi a KeyRent: la modifica guidata arriva con il prossimo aggiornamento.</p>
      </section>
    </div>
  );
}

function StateButton({ id, to, label, primary = false }: { id: string; to: string; label: string; primary?: boolean }) {
  return (
    <form action={transitionListing}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />
      <button className={primary ? "btn-primary" : "btn-ghost"}>{label}</button>
    </form>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 border-b border-line py-1.5"><dt className="capitalize text-mute">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}
