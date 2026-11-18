import { Suspense } from "react";
import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/supabase/public";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { AutoImage, CatalogUploader } from "./CatalogUploader";
import { removeCatalogImage } from "../actions";

export const metadata = { title: "Foto catalogo" };

export const maxDuration = 90;

export default function Page({ searchParams }: PageProps<"/admin/foto">) {
  return <Suspense fallback={<Skeleton />}><Catalog searchParams={searchParams} /></Suspense>;
}

async function Catalog({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireStaff();
  const db = await userDb();
  const [cats, models, images, listings] = await Promise.all([
    db.from("categories").select("id, slug, name_it").order("sort"),
    db.from("models").select("id, name, category_id, makes(name)").order("name"),
    db.from("catalog_images").select("id, category_id, model_id, storage_path"),
    db.from("listings").select("model_id, category_id, listing_media(id)").neq("status", "rejected"),
  ]);
  if (images.error) {
    return (
      <div className="space-y-4">
        <ProHeader title="Foto catalogo" subtitle="Manca un aggiornamento del database." />
        <p className="card p-4 text-sm">Esegui prima nell&apos;editor SQL di Supabase il blocco &quot;Foto catalogo&quot; che ti ho mandato in chat.</p>
      </div>
    );
  }
  type M = { id: string; name: string; category_id: string; makes: { name: string } };
  const img = new Map((images.data ?? []).map((i) => [`${i.category_id}|${i.model_id ?? ""}`, i]));
  const without = new Map<string, number>(); // annunci senza foto per modello / categoria
  for (const l of (listings.data ?? []) as { model_id: string | null; category_id: string; listing_media: { id: string }[] }[]) {
    if (l.listing_media.length > 0) continue;
    const k = `${l.category_id}|${l.model_id ?? ""}`;
    without.set(k, (without.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <ProHeader title="Foto catalogo"
        subtitle="Immagini indicative mostrate negli annunci senza foto. Prima quella del modello, altrimenti quella generica della categoria." />
      <Flash sp={sp} ok={{ rimossa: "Immagine rimossa." }} />
      <div className="card bg-teal-50 p-4 text-sm text-navy-800">
        <p className="font-semibold">Come si fa</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>Premi &quot;✨ Crea in automatico&quot;: l&apos;immagine si crea in circa 20-30 secondi.</li>
          <li>Se non ti piace premi di nuovo per crearne un&apos;altra, oppure carica una tua immagine.</li>
        </ol>
        <p className="mt-2 text-xs text-mute">Sul sito comparirà sempre l&apos;etichetta &quot;Immagine indicativa&quot;. Appena il noleggiatore carica le sue foto, vengono mostrate quelle.</p>
      </div>

      {(cats.data ?? []).map((c) => {
        const ms = ((models.data ?? []) as unknown as M[]).filter((m) => m.category_id === c.id);
        const rows = [{ id: null as string | null, label: `${c.name_it} · immagine generica`, what: undefined as string | undefined }, ...ms.map((m) => ({ id: m.id, label: `${m.makes.name} ${m.name}`, what: `${m.makes.name} ${m.name}` }))];
        return (
          <section key={c.id}>
            <h2 className="mb-2 font-bold">{c.name_it}</h2>
            <div className="card divide-y divide-line">
              {rows.map((r) => {
                const k = `${c.id}|${r.id ?? ""}`;
                const i = img.get(k);
                const n = without.get(k) ?? 0;
                return (
                  <div key={k} className="flex flex-wrap items-center gap-4 p-3">
                    <div className="relative h-16 w-24 flex-none overflow-hidden rounded-lg bg-navy-50">
                      {i && <Image src={mediaUrl(i.storage_path)} alt={r.label} fill sizes="96px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="text-xs text-mute">
                        {i ? "Immagine presente" : "Nessuna immagine"}{n > 0 ? ` · ${n} ${n === 1 ? "annuncio" : "annunci"} senza foto` : ""}
                      </p>
                      <AutoImage categoryId={c.id} modelId={r.id} />
                    </div>
                    <div className="flex items-center gap-2">
                      <CatalogUploader categoryId={c.id} modelId={r.id} hasImage={!!i} />
                      {i && (
                        <form action={removeCatalogImage}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="px-2 py-2 text-sm text-red-700 hover:underline">Rimuovi</button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
