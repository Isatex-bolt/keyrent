import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/supabase/public";
import { Badge, listingStatus, orgStatus } from "@/lib/status";
import { euro, priceUnitLabel } from "@/lib/format";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { reviewChanges, reviewListing } from "../../actions";

export const metadata = { title: "Revisione annuncio" };

export default function Page({ params, searchParams }: PageProps<"/admin/revisione/[id]">) {
  return <Suspense fallback={<Skeleton />}><Detail params={params} searchParams={searchParams} /></Suspense>;
}

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const { role } = await requireStaff();
  const db = await userDb();
  const [{ data: l }, { data: media }, { data: prices }, { data: terms }, { data: revs }, { data: audit }] = await Promise.all([
    db.from("listings").select("*, categories(name_it), makes(name), models(name), locations(name, address_line, city, province), organizations(id, legal_name, trade_name, vat_number, verification_status)").eq("id", id).maybeSingle(),
    db.from("listing_media").select("storage_path, moderation_status").eq("listing_id", id).order("sort"),
    db.from("pricing_rules").select("unit, price_cents, valid_from").eq("listing_id", id),
    db.from("rental_terms").select("*").eq("listing_id", id).maybeSingle(),
    db.from("listing_revisions").select("id, number, status, snapshot, review_notes, submitted_at").eq("listing_id", id).order("number", { ascending: false }),
    db.from("audit_log").select("action, reason, created_at").eq("entity", "listing").eq("entity_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!l) notFound();
  const pendingChange = (revs ?? []).find((r) => r.status === "pending_review" && r.snapshot?.changes);
  const o = l.organizations;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/revisione" className="text-sm text-mute hover:text-navy-900">← Revisione annunci</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{l.title}</h1>
          <Badge map={listingStatus} value={l.status} />
        </div>
        <p className="text-sm text-mute">{o.legal_name} · P.IVA {o.vat_number} · <Badge map={orgStatus} value={o.verification_status} /></p>
      </div>
      <Flash sp={sp} ok={{ changes_required: "Modifiche richieste al noleggiatore.", rejected: "Annuncio rifiutato.", suspended: "Annuncio sospeso.",
        published: "Annuncio di nuovo online.", unpublished: "Annuncio depubblicato.", "modifica-approvata": "Modifica approvata e online.", "modifica-respinta": "Modifica respinta." }} />

      {l.status === "pending_review" && (
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Decisione</h2>
          {o.verification_status !== "verified" && <p className="rounded-xl bg-amber-50 p-3 text-sm">L&apos;attività non è verificata: verificala prima in <Link href="/admin/anagrafiche" className="underline">Anagrafiche</Link>.</p>}
          <form action={reviewListing}><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value="approved" />
            <button className="btn-primary">Approva e pubblica</button></form>
          <form action={reviewListing} className="space-y-2">
            <input type="hidden" name="id" value={id} />
            <textarea name="reason" required rows={3} className="field" placeholder="Cosa deve correggere il noleggiatore? (obbligatorio per richiedere modifiche o rifiutare)" />
            <div className="flex flex-wrap gap-2">
              <button name="to" value="changes_required" className="btn-ghost">Richiedi modifiche</button>
              <button name="to" value="rejected" className="btn-ghost text-red-700">Rifiuta</button>
            </div>
          </form>
        </div>
      )}
      {pendingChange && (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">Modifica proposta (l&apos;annuncio resta online)</h2>
          <dl className="space-y-2 text-sm">
            {Object.entries(pendingChange.snapshot.changes as Record<string, unknown>).map(([k, v]) => (
              <div key={k}><dt className="text-mute">{k}</dt><dd className="whitespace-pre-line rounded-lg bg-canvas p-2">{typeof v === "string" ? v : deliveryText(v) ?? JSON.stringify(v)}</dd>
                <dd className="mt-1 text-xs text-mute">Attuale: {String((l as Record<string, unknown>)[k] ?? "—").slice(0, 300)}</dd></div>
            ))}
          </dl>
          <form action={reviewChanges} className="space-y-2">
            <input type="hidden" name="listing_id" value={id} /><input type="hidden" name="revision_id" value={pendingChange.id} />
            <input name="reason" className="field" placeholder="Nota (facoltativa)" />
            <div className="flex gap-2"><button name="approve" value="true" className="btn-primary">Approva modifica</button><button name="approve" value="false" className="btn-ghost">Respingi</button></div>
          </form>
        </div>
      )}
      {l.status === "published" && (
        <form action={reviewListing} className="card flex flex-wrap items-center gap-2 p-4">
          <input type="hidden" name="id" value={id} />
          <input name="reason" className="field max-w-sm" placeholder="Motivo (obbligatorio per sospendere)" />
          {role === "admin" && <button name="to" value="suspended" className="btn-ghost text-red-700">Sospendi</button>}
          <button name="to" value="unpublished" className="btn-ghost">Depubblica</button>
        </form>
      )}
      {l.status === "suspended" && role === "admin" && (
        <form action={reviewListing} className="card p-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value="published" />
          <button className="btn-primary">Riattiva</button></form>
      )}

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Foto ({media?.length ?? 0})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(media ?? []).map((m) => (
            <a key={m.storage_path} href={mediaUrl(m.storage_path)} target="_blank" className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-navy-50">
              <Image src={mediaUrl(m.storage_path)} alt="" fill sizes="25vw" className="object-cover" />
            </a>
          ))}
        </div>
      </section>

      <section className="card grid gap-6 p-5 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold">Dati</h2>
          <p><span className="text-mute">Categoria:</span> {l.categories?.name_it}</p>
          <p><span className="text-mute">Marca/modello:</span> {[l.makes?.name, l.models?.name].filter(Boolean).join(" ") || "non a catalogo"}</p>
          <p><span className="text-mute">Sede:</span> {l.locations?.name}, {l.locations?.address_line}, {l.locations?.city} ({l.locations?.province})</p>
          <p><span className="text-mute">Modalità:</span> {l.quantity_mode === "pool" ? "più unità identiche" : "mezzo singolo"}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-2 text-xs">{JSON.stringify(l.attributes, null, 2)}</pre>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Prezzi e condizioni</h2>
          {(prices ?? []).map((p) => <p key={p.unit + p.valid_from}>{priceUnitLabel[p.unit]}: <strong>{euro(p.price_cents)}</strong></p>)}
          <p className="mt-2"><span className="text-mute">Cauzione:</span> {terms?.deposit_cents ? euro(terms.deposit_cents) : "nessuna"}</p>
          {terms?.min_driver_age && <p><span className="text-mute">Età minima:</span> {terms.min_driver_age}</p>}
        </div>
        <div className="sm:col-span-2">
          <h2 className="mb-2 font-semibold">Descrizione</h2>
          <p className="whitespace-pre-line leading-relaxed">{l.description}</p>
        </div>
      </section>

      <section className="card p-5 text-sm">
        <h2 className="mb-2 font-semibold">Storico</h2>
        <ul className="space-y-1">
          {(audit ?? []).map((a, i) => <li key={i} className="flex justify-between gap-4"><span>{a.action}{a.reason ? ` — ${a.reason}` : ""}</span><span className="text-mute">{new Date(a.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</span></li>)}
          {!audit?.length && <li className="text-mute">Nessun evento.</li>}
        </ul>
      </section>
    </div>
  );
}

/** Consegna proposta in una revisione, in parole semplici. */
function deliveryText(v: unknown): string | null {
  const t = v as { delivery_enabled?: boolean; delivery_radius_km?: number; delivery_fee_cents?: number; delivery_per_km_cents?: number } | null;
  if (!t || typeof t !== "object" || !("delivery_enabled" in t)) return null;
  if (!t.delivery_enabled) return "Consegna a domicilio: disattivata";
  const e = (c = 0) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);
  return `Consegna a domicilio: entro ${t.delivery_radius_km} km · ${e(t.delivery_fee_cents)} fisso + ${e(t.delivery_per_km_cents)}/km`;
}
