import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { CATALOG } from "@/data/catalog";
import { CATEGORIES } from "@/lib/catalog";
import { FormError, FormNotice } from "@/components/AuthCard";
import { ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { syncCatalogAction } from "../actions";

export const metadata = { title: "Catalogo" };
export const maxDuration = 60;

export default function Page({ searchParams }: PageProps<"/admin/catalogo">) {
  return <Suspense fallback={<Skeleton />}><Catalog searchParams={searchParams} /></Suspense>;
}

async function Catalog({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireStaff();
  const db = serviceDb();
  const [{ count: dbModels }, { data: custom }] = await Promise.all([
    db.from("models").select("id", { count: "exact", head: true }),
    db.from("vehicle_units").select("custom_make, custom_model, categories(name_it)").not("custom_model", "is", null).limit(200),
  ]);
  const ok = typeof sp.ok === "string" ? sp.ok.split("|") : null;
  const perCat = CATEGORIES.map((c) => {
    const e = CATALOG.filter((x) => x.category === c.slug);
    return { name: c.name, makes: new Set(e.map((x) => x.makeSlug)).size, models: e.length };
  });
  type U = { custom_make: string | null; custom_model: string | null; categories: { name_it: string } | null };
  const manual = [...new Map(((custom ?? []) as unknown as U[]).map((u) => [`${u.categories?.name_it}|${u.custom_make}|${u.custom_model}`, u])).values()];

  return (
    <div className="space-y-6">
      <ProHeader title="Catalogo marche e modelli" subtitle="I modelli che i noleggiatori trovano scrivendo, e che i clienti usano nei filtri di ricerca." />
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <FormNotice message={ok ? `Catalogo aggiornato: ${ok[0]} marche e ${ok[1]} modelli controllati.` : undefined} />

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{CATALOG.length} modelli nel catalogo del sito · {dbModels ?? 0} nel database</p>
            <p className="text-sm text-mute">Premi &quot;Aggiorna&quot; per copiare nel database i modelli che mancano (servono ai filtri di ricerca). Non cancella nulla.</p>
          </div>
          <form action={syncCatalogAction}><button className="btn-primary">Aggiorna catalogo</button></form>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {perCat.map((c) => (
            <div key={c.name} className="rounded-xl bg-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">{c.name}</p>
              <p className="text-lg font-bold">{c.models}</p>
              <p className="text-xs text-mute">modelli · {c.makes} marche</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Modelli inseriti a mano dai noleggiatori</h2>
        <p className="text-sm text-mute">Non erano nel catalogo. Scrivimi in chat quelli da aggiungere e li inserisco.</p>
        {manual.length === 0 ? <p className="mt-3 text-sm text-mute">Nessuno per ora.</p> : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {manual.map((u, i) => (
              <li key={i} className="flex justify-between py-2"><span className="font-medium">{u.custom_make} {u.custom_model}</span><span className="text-mute">{u.categories?.name_it}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
