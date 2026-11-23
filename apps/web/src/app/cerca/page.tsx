import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { AutoSubmit } from "@/components/AutoSubmit";
import { ResultsView, type ResultItem } from "@/components/ResultsView";
import { categoryName } from "@/lib/catalog";
import { findPlace } from "@/lib/places";
import { formatDateIt, romeToIso } from "@/lib/format";
import { listingHref } from "@/lib/urls";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { attributesForCategory, makesForCategory, searchMap, MAP_LIMIT } from "@/lib/data";

export const metadata: Metadata = { title: "Cerca mezzi a noleggio" };

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const hasMap = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export default function SearchPage({ searchParams }: PageProps<"/cerca">) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

function num(v: string | undefined, min: number, max: number) {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, d));
  return t.toISOString().slice(0, 10);
}

async function Results({ searchParams }: { searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const sp: Record<string, string | undefined> = Object.fromEntries(Object.keys(raw).map((k) => [k, first(raw[k])]));
  const cat = categoryName(sp.cat) ? sp.cat : undefined;
  const notes: string[] = [];

  // Dove: coordinate dall'autocompletamento, altrimenti città dell'elenco, oppure area della mappa
  const zona = sp.zona?.split(",").map(Number);
  const bbox = zona && zona.length === 4 && zona.every(Number.isFinite) && zona[0] < zona[2] && zona[1] < zona[3]
    ? (zona as [number, number, number, number]) : null;
  let lat = num(sp.lat, 35, 48), lng = num(sp.lng, 6, 19);
  const place = lat == null ? findPlace(sp.luogo) : undefined;
  if (place) { lat = place.lat; lng = place.lng; }
  if (sp.luogo && lat == null && !bbox) notes.push(`Non abbiamo trovato "${sp.luogo}": mostriamo i risultati in tutta Italia.`);
  const center = lat != null && lng != null ? { lat, lng } : null;

  // Quando
  if (sp.mesi && sp.dal && !sp.al) {
    const m = num(sp.mesi, 1, 24);
    if (m) sp.al = addMonths(sp.dal, m);
  }
  let pickup = sp.dal ? romeToIso(sp.dal, sp.ora_ritiro ?? "10:00") : null;
  // stesso giorno senza orari: ritiro 10:00, riconsegna 19:00
  let ret = sp.al ? romeToIso(sp.al, sp.ora_riconsegna ?? (sp.al === sp.dal ? "19:00" : "10:00")) : null;
  if (pickup && ret && ret <= pickup) { notes.push("La riconsegna deve essere dopo il ritiro."); pickup = ret = null; }
  if ((pickup && !ret) || (!pickup && ret)) { notes.push("Indica sia il ritiro sia la riconsegna per vedere prezzi totali e disponibilità."); pickup = ret = null; }

  if (!isSupabaseConfigured()) {
    return <Shell sp={sp} summary=""><p className="p-6">Il collegamento al database non è ancora configurato.</p></Shell>;
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
  const priceMax = Number(sp.prezzo_max) > 0 ? Math.round(Number(sp.prezzo_max) * 100) : undefined;
  const instantOnly = sp.immediata === "1";

  const results = await searchMap({
    bbox, lat: bbox ? undefined : lat, lng: bbox ? undefined : lng, radiusKm: 40, pickup, ret,
    category: cat, subcategory: cat && sp.sub && /^[a-z0-9-]{2,40}$/.test(sp.sub) ? sp.sub : undefined, make: make?.slug, model: model?.slug, filters, priceMaxCents: priceMax, instantOnly,
    sort: sp.ordina,
  });
  const total = Number(results[0]?.total_count ?? 0);
  const keep = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const items: ResultItem[] = results.map((r) => ({ ...r, href: listingHref(r, keep) }));

  const where = bbox ? "nella zona della mappa" : sp.luogo && center ? (/^vicino a me$/i.test(sp.luogo) ? "vicino a te" : `vicino a ${sp.luogo}`) : "in Italia";
  const what = model ? `${make?.name} ${model.name}` : make?.name ?? categoryName(cat) ?? "Mezzi";
  const when = sp.dal && sp.al && pickup ? `${formatDateIt(sp.dal)} → ${formatDateIt(sp.al)}` : "";
  const summary = [sp.luogo || (bbox ? "Zona della mappa" : "Tutta Italia"), when, categoryName(cat)].filter(Boolean).join(" · ");
  const activeFilters = Number(Boolean(make)) + Object.keys(filters).length + Number(Boolean(priceMax)) + Number(instantOnly);
  const baseKeys = ["luogo", "lat", "lng", "zona", "dal", "al", "ora_ritiro", "ora_riconsegna", "cat", "sub"];

  const top = (
    <>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">{what} {where}</h1>
        <p className="text-sm text-mute">
          {total > MAP_LIMIT ? `primi ${MAP_LIMIT} di ${total}` : `${total} ${total === 1 ? "risultato" : "risultati"}`}
          {pickup ? " · prezzi totali per le tue date" : ""}
        </p>
      </div>
      {notes.map((n) => <p key={n} className="mb-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-navy-800">{n}</p>)}

      <details className="card mb-4 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
          <span>Filtri{activeFilters > 0 ? ` (${activeFilters})` : ""}</span>
          <span className="text-teal-600">mostra</span>
        </summary>
        <form method="get" action="/cerca" className="mt-3">
          {baseKeys.map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
          <AutoSubmit>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-medium sm:col-span-2">
                <input type="checkbox" name="immediata" value="1" defaultChecked={instantOnly} className="h-4 w-4 accent-teal-600" />
                ⚡ Solo prenotazione immediata
              </label>
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
                <label className="label" htmlFor="f-prezzo">{pickup ? "Totale massimo (€)" : "Prezzo massimo (€)"}</label>
                <input id="f-prezzo" name="prezzo_max" type="number" min="1" inputMode="numeric" className="field"
                  defaultValue={sp.prezzo_max ?? ""} placeholder="Nessun limite" />
              </div>
              <div>
                <label className="label" htmlFor="f-ordina">Ordina per</label>
                <select id="f-ordina" name="ordina" className="field" defaultValue={sp.ordina ?? ""}>
                  <option value="">Consigliati</option>
                  <option value="price_asc">Prezzo crescente</option>
                  <option value="price_desc">Prezzo decrescente</option>
                  {center && !bbox && <option value="distance">Distanza</option>}
                </select>
              </div>
            </div>
          </AutoSubmit>
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" className="btn-ghost">Applica</button>
            {activeFilters > 0 && (
              <Link href={`/cerca?${new URLSearchParams(baseKeys.filter((k) => sp[k]).map((k) => [k, sp[k]!])).toString()}`}
                className="text-sm text-teal-600 hover:underline">Azzera filtri</Link>
            )}
          </div>
        </form>
      </details>

      {items.length === 0 && (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <p className="text-lg font-semibold">Nessun mezzo trovato</p>
          <p className="mt-1 text-sm text-mute">
            {bbox ? "Allarga la mappa e premi “Cerca in questa zona”, oppure cambia date o filtri." : "Prova a cambiare date, località o filtri."}
          </p>
        </div>
      )}
    </>
  );

  return (
    <Shell sp={sp} summary={summary}>
      <ResultsView items={items} top={top} center={center} bbox={bbox} hasMap={hasMap} />
    </Shell>
  );
}

function Shell({ sp, summary, children }: { sp: Record<string, string | undefined>; summary: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="relative z-20 border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <SearchForm summary={summary}
            values={{ luogo: sp.luogo, lat: sp.lat, lng: sp.lng, dal: sp.dal, al: sp.al, cat: sp.cat, ora_ritiro: sp.ora_ritiro, ora_riconsegna: sp.ora_riconsegna }} />
        </div>
      </div>
      {children}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 h-14 animate-pulse rounded-2xl bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-white" />)}
      </div>
    </div>
  );
}
