import { Suspense } from "react";
import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/supabase/public";
import { TILE_GRADIENT } from "@/lib/content";
import { CATEGORIES } from "@/lib/catalog";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { PlaceInput } from "@/components/PlaceInput";
import { ContentImage } from "./ContentImage";
import { deleteDestination, saveCollection, saveDestination } from "../actions";

export const metadata = { title: "Contenuti home" };
export const maxDuration = 90;

type Col = { slug: string; title: string; subtitle: string; query: string; image_path: string | null; active: boolean };
type Dest = { slug: string; name: string; region: string; tagline: string; description: string; latitude: number; longitude: number;
  radius_km: number; categories: string[]; image_path: string | null; active: boolean };

export default function Page({ searchParams }: PageProps<"/admin/home">) {
  return <Suspense fallback={<Skeleton />}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireStaff();
  const db = serviceDb(); // l'admin vede anche gli elementi disattivati
  const [c, d] = await Promise.all([
    db.from("home_collections").select("*").order("sort"),
    db.from("destinations").select("*").order("sort"),
  ]);
  if (c.error || d.error) {
    return (
      <div className="space-y-4">
        <ProHeader title="Contenuti home" subtitle="Manca un aggiornamento del database." />
        <p className="card p-4 text-sm">Esegui prima in Supabase i blocchi SQL &quot;Home&quot; e &quot;permessi&quot; che ti ho mandato in chat. ({(c.error ?? d.error)?.message})</p>
      </div>
    );
  }
  const cols = (c.data ?? []) as Col[], dests = (d.data ?? []) as Dest[];
  return (
    <div className="space-y-8">
      <ProHeader title="Contenuti home" subtitle="Testi e foto dei riquadri “Cosa ti serve oggi?” e delle mete “Dove andare”. Premi “Modifica testi” per cambiarli." />
      <Flash sp={sp} ok={{ salvato: "Modifiche salvate: sono già online.", eliminata: "Meta eliminata." }} />

      <section>
        <h2 className="mb-2 text-lg font-bold">Cosa ti serve oggi?</h2>
        <div className="card divide-y divide-line">
          {cols.map((x) => {
            const q = new URLSearchParams(x.query);
            return (
              <div key={x.slug} id={`c-${x.slug}`} className="p-3">
                <Head img={x.image_path} grad={TILE_GRADIENT[x.slug]} title={x.title} sub={x.subtitle} active={x.active} kind="collection" slug={x.slug} />
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-teal-600">Modifica testi</summary>
                  <form action={saveCollection} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="slug" value={x.slug} />
                    <Field label="Titolo" name="title" value={x.title} />
                    <Field label="Sottotitolo" name="subtitle" value={x.subtitle} />
                    <div>
                      <label className="label">Apre la ricerca su</label>
                      <select name="cat" defaultValue={q.get("cat") ?? ""} className="field">
                        <option value="">Tutti i mezzi</option>
                        {CATEGORIES.map((k) => <option key={k.slug} value={k.slug}>{k.name}</option>)}
                      </select>
                    </div>
                    <Field label="Sottocategoria (facoltativa, es. e-bike)" name="sub" value={q.get("sub") ?? ""} required={false} />
                    <Active value={x.active} />
                    <div className="sm:col-span-2"><button className="btn-primary">Salva</button></div>
                  </form>
                </details>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Dove andare</h2>
        <div className="card divide-y divide-line">
          {dests.map((x) => (
            <div key={x.slug} id={`d-${x.slug}`} className="p-3">
              <Head img={x.image_path} title={x.name} sub={`${x.region} · ${x.tagline}`} active={x.active} kind="destination" slug={x.slug} />
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-teal-600">Modifica testi</summary>
                <DestForm d={x} />
                <form action={deleteDestination} className="mt-2">
                  <input type="hidden" name="slug" value={x.slug} />
                  <button className="text-sm text-red-700 hover:underline">Elimina questa meta</button>
                </form>
              </details>
            </div>
          ))}
        </div>
        <details className="card mt-4 p-4">
          <summary className="cursor-pointer font-semibold text-teal-600">+ Aggiungi una meta</summary>
          <DestForm />
        </details>
      </section>
    </div>
  );
}

function Head({ img, grad, title, sub, active, kind, slug }: { img: string | null; grad?: string; title: string; sub: string; active: boolean; kind: "collection" | "destination"; slug: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className={`relative h-20 w-32 flex-none overflow-hidden rounded-xl bg-gradient-to-br ${grad ?? "from-navy-800 to-teal-500"}`}>
        {img && <Image src={mediaUrl(img)} alt="" fill sizes="128px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title} {!active && <span className="ml-1 rounded bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-mute">nascosta</span>}</p>
        <p className="text-xs text-mute">{sub}{img ? "" : " · nessuna foto"}</p>
      </div>
      <ContentImage kind={kind} slug={slug} />
    </div>
  );
}

function Field({ label, name, value = "", required = true }: { label: string; name: string; value?: string; required?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} defaultValue={value} required={required} className="field" />
    </div>
  );
}

function Active({ value }: { value: boolean }) {
  return (
    <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
      <input type="checkbox" name="active" defaultChecked={value} className="h-4 w-4 accent-teal-600" /> Visibile sul sito
    </label>
  );
}

function DestForm({ d }: { d?: Dest }) {
  return (
    <form action={saveDestination} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={d?.slug ?? ""} />
      <Field label="Nome" name="name" value={d?.name} />
      <Field label="Regione" name="region" value={d?.region} />
      <div className="sm:col-span-2"><Field label="Frase breve (sotto il nome)" name="tagline" value={d?.tagline} /></div>
      <div className="sm:col-span-2">
        <label className="label">Descrizione</label>
        <textarea name="description" defaultValue={d?.description} required rows={4} className="field" />
      </div>
      <div>
        <label className="label">{d ? "Luogo (cambialo solo se vuoi spostare la meta)" : "Luogo sulla mappa"}</label>
        <PlaceInput name={d ? "" : undefined} />
        {d && <p className="mt-1 text-xs text-mute">Attuale: {d.latitude.toFixed(3)}, {d.longitude.toFixed(3)}</p>}
      </div>
      <div>
        <label className="label">Raggio di ricerca (km)</label>
        <input name="radius_km" type="number" min={5} max={150} defaultValue={d?.radius_km ?? 30} className="field" />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">Mezzi da mostrare nella pagina</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((k) => (
            <label key={k.slug} className="chip cursor-pointer has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white">
              <input type="checkbox" name="categories" value={k.slug} defaultChecked={d?.categories.includes(k.slug)} className="sr-only" />
              {k.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Active value={d?.active ?? true} />
      <div className="sm:col-span-2"><button className="btn-primary">{d ? "Salva" : "Aggiungi meta"}</button></div>
    </form>
  );
}
