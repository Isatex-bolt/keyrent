import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { ListingCard } from "@/components/ListingCard";
import { AutoSubmit } from "@/components/AutoSubmit";
import { categoryName } from "@/lib/catalog";
import { findPlace } from "@/lib/places";
import { romeToIso } from "@/lib/format";
import { listingHref, withParams } from "@/lib/urls";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { attributesForCategory, makesForCategory, searchListings, PAGE_SIZE } from "@/lib/data";

export const metadata: Metadata = { title: "Cerca mezzi a noleggio" };

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default function SearchPage({ searchParams }: PageProps<"/cerca">) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const sp: Record<string, string | undefined> = Object.fromEntries(Object.keys(raw).map((k) => [k, first(raw[k])]));
  const cat = categoryName(sp.cat) ? sp.cat : undefined;
  const place = findPlace(sp.luogo);
  const notes: string[] = [];
  if (sp.luogo && !place) notes.push(`Non abbiamo trovato "${sp.luogo}": mostriamo i risultati in tutta Italia.`);

  let pickup = sp.dal ? romeToIso(sp.dal, sp.ora_ritiro ?? "10:00") : null;
  let ret = sp.al ? romeToIso(sp.al, sp.ora_riconsegna ?? "10:00") : null;
  if (pickup && ret && ret <= pickup) { notes.push("La data di riconsegna deve essere successiva al ritiro."); pickup = ret = null; }
  if ((pickup && !ret) || (!pickup && ret)) { notes.push("Indica sia la data di ritiro sia quella di riconsegna per vedere la disponibilità."); pickup = ret = null; }

  if (!isSupabaseConfigured()) {
    return <Shell sp={sp}><Empty title="Configurazione in corso" text="Il collegamento al database non è ancora configurato." /></Shell>;
  }

  const [makes, attrs] = cat ? await Promise.all([makesForCategory(cat), attributesForCategory(cat)]) : [[], []];
  const filterAttrs = attrs.filter((a) => a.filterable && (a.data_type === "enum" || a.data_type === "boolean"));
  const filters: Record<string, unknown> = {};
  for (const a of filterAttrs) {
    const v = sp[`a_${a.key}`];
    if (!v) continue;
    if (a.data_type === "boolean") filters[a.key] = v === "si";
    else if (a.options?.includes(v)) filters[a.key] = v;
  }
  const make = makes.find((m) => m.slug === sp.marca);
  const model = make?.models.find((m) => m.slug === sp.modello);
  const page = Math.max(1, Number(sp.pagina) || 1);
  const priceMax = Number(sp.prezzo_max) > 0 ? Math.round(Number(sp.prezzo_max) * 100) : undefined;

  const results = await searchListings({
    lat: place?.lat, lng: place?.lng, radiusKm: 40, pickup, ret,
    category: cat, make: make?.slug, model: model?.slug, filters, priceMaxCents: priceMax,
    sort: sp.ordina, page,
  });
  const total = results[0]?.total_count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);
  const keep = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);

  const heading = [model ? `${make?.name} ${model.name}` : make?.name ?? categoryName(cat) ?? "Mezzi", place ? `a ${place.name}` : "in Italia"].join(" ");

  return (
    <Shell sp={sp}>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <details className="card group p-4 lg:open:block" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold lg:cursor-default">
              Filtri <span className="text-sm font-normal text-mute lg:hidden">mostra/nascondi</span>
            </summary>
            <form method="get" action="/cerca" className="mt-4 space-y-4">
              {["luogo", "dal", "al", "ora_ritiro", "ora_riconsegna", "cat"].map((k) =>
                sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null)}
              <AutoSubmit>
                <div className="space-y-4">
                  {cat && makes.length > 0 && (
                    <div>
                      <label className="label" htmlFor="f-marca">Marca</label>
                      <select id="f-marca" name="marca" className="field" defaultValue={make?.slug ?? ""}>
                        <option value="">Tutte le marche</option>
                        {makes.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                  {make && (
                    <div>
                      <label className="label" htmlFor="f-modello">Modello</label>
                      <select id="f-modello" name="modello" className="field" defaultValue={model?.slug ?? ""}>
                        <option value="">Tutti i modelli</option>
                        {make.models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                  {filterAttrs.map((a) => (
                    <div key={a.key}>
                      <label className="label" htmlFor={`f-${a.key}`}>{a.label_it}</label>
                      <select id={`f-${a.key}`} name={`a_${a.key}`} className="field" defaultValue={sp[`a_${a.key}`] ?? ""}>
                        <option value="">Indifferente</option>
                        {a.data_type === "boolean"
                          ? <><option value="si">Sì</option><option value="no">No</option></>
                          : a.options?.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="label" htmlFor="f-prezzo">Prezzo massimo (€ al giorno)</label>
                    <input id="f-prezzo" name="prezzo_max" type="number" min="1" inputMode="numeric" className="field"
                      defaultValue={sp.prezzo_max ?? ""} placeholder="Nessun limite" />
                  </div>
                  <div>
                    <label className="label" htmlFor="f-ordina">Ordina per</label>
                    <select id="f-ordina" name="ordina" className="field" defaultValue={sp.ordina ?? ""}>
                      <option value="">Più recenti</option>
                      <option value="price_asc">Prezzo crescente</option>
                      <option value="price_desc">Prezzo decrescente</option>
                      {place && <option value="distance">Distanza</option>}
                    </select>
                  </div>
                </div>
              </AutoSubmit>
              <button type="submit" className="btn-ghost w-full">Applica filtri</button>
              {(make || Object.keys(filters).length > 0 || priceMax) && (
                <Link href={withParams({ luogo: sp.luogo, dal: sp.dal, al: sp.al, cat }, {})} className="block text-center text-sm text-teal-600 hover:underline">
                  Azzera filtri
                </Link>
              )}
            </form>
          </details>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{heading}</h1>
            <p className="text-sm text-mute">{total} {total === 1 ? "risultato" : "risultati"}{pickup ? " disponibili nelle date scelte" : ""}</p>
          </div>
          {notes.map((n) => <p key={n} className="mb-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-navy-800">{n}</p>)}
          {results.length === 0 ? (
            <Empty title="Nessun mezzo trovato" text="Prova a cambiare date, località o filtri." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => <ListingCard key={r.id} r={r} href={listingHref(r, keep)} />)}
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagine">
              {page > 1 && <Link className="btn-ghost" href={withParams(sp, { pagina: String(page - 1) })}>← Precedente</Link>}
              <span className="px-3 text-sm text-mute">Pagina {page} di {pages}</span>
              {page < pages && <Link className="btn-ghost" href={withParams(sp, { pagina: String(page + 1) })}>Successiva →</Link>}
            </nav>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ sp, children }: { sp: Record<string, string | undefined>; children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <SearchForm compact values={{ luogo: sp.luogo, dal: sp.dal, al: sp.al, cat: sp.cat }} />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-mute">{text}</p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 h-16 animate-pulse rounded-2xl bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white" />)}
      </div>
    </div>
  );
}
