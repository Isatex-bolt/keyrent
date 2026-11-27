import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { matchKeyword } from "@/lib/keyword";
import { SearchForm } from "@/components/SearchForm";
import { AutoSubmit } from "@/components/AutoSubmit";
import { ResultsView, type ResultItem } from "@/components/ResultsView";
import { CATEGORIES, categoryName, isSelectCategory } from "@/lib/catalog";
import { SaveSearch } from "@/components/RecentSearches";
import { findPlace } from "@/lib/places";
import { formatDateIt, romeToIso } from "@/lib/format";
import { listingHref } from "@/lib/urls";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { attributesForCategory, getOffers, getRatings, makesForCategory, searchMap, MAP_LIMIT } from "@/lib/data";

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

function addMonths(date: string, months: number, days = 0) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, d + days));
  return t.toISOString().slice(0, 10);
}

async function Results({ searchParams }: { searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const sp: Record<string, string | undefined> = Object.fromEntries(Object.keys(raw).map((k) => [k, first(raw[k])]));
  const cat = categoryName(sp.cat) ? sp.cat : undefined;
  const notes: string[] = [];
  // "Cosa cerchi?" della home: la parola diventa categoria / marca / modello / Select / lungo termine
  if (sp.q !== undefined) {
    const m = await matchKeyword(sp.q);
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["q", "kw", "cat", "marca", "modello", "nonfound"].includes(k)) as [string, string][]);
    if (m?.cat) q.set("cat", m.cat);
    if (m?.marca) q.set("marca", m.marca);
    if (m?.modello) q.set("modello", m.modello);
    if (m?.select) q.set("select", "1");
    if (m?.lungo && !q.get("lungo")) { q.set("lungo", "1"); q.delete("al"); }
    if (!m && sp.q.trim()) q.set("nonfound", sp.q.trim().slice(0, 40));
    if (m && sp.q.trim()) q.set("kw", sp.q.trim().slice(0, 40)); // la parola resta visibile nel campo "Cosa"
    redirect(`/cerca?${q.toString()}`);
  }
  if (sp.nonfound) notes.push(`Non abbiamo trovato «${sp.nonfound}»: ecco tutti i mezzi disponibili. Prova con una marca, un modello o un tipo di mezzo.`);
  // Standard = tutti i mezzi (i Select si riconoscono dalla fascia sulla foto) · Select = solo mezzi Select
  const select = sp.select === "1";

  // Dove: coordinate dall'autocompletamento, altrimenti città dell'elenco, oppure area della mappa
  const zona = sp.zona?.split(",").map(Number);
  const bbox = zona && zona.length === 4 && zona.every(Number.isFinite) && zona[0] < zona[2] && zona[1] < zona[3]
    ? (zona as [number, number, number, number]) : null;
  let lat = num(sp.lat, 35, 48), lng = num(sp.lng, 6, 19);
  const place = lat == null ? findPlace(sp.luogo) : undefined;
  if (place) { lat = place.lat; lng = place.lng; }
  if (sp.luogo && lat == null && !bbox) notes.push(`Non abbiamo trovato "${sp.luogo}": mostriamo i risultati in tutta Italia.`);
  const center = lat != null && lng != null ? { lat, lng } : null;

  // Lungo termine: niente date, rata mensile "da"
  const lungo = sp.lungo === "1";
  if (lungo) { delete sp.al; delete sp.mesi; }
  // Quando
  if (!lungo && sp.mesi && sp.dal && !sp.al) {
    const m = num(sp.mesi, 1, 24);
    if (m) sp.al = addMonths(sp.dal, m);
  }
  let pickup = !lungo && sp.dal ? romeToIso(sp.dal, sp.ora_ritiro ?? "10:00") : null;
  let ret = sp.al ? romeToIso(sp.al, sp.ora_riconsegna ?? "10:00") : null;
  // stesso giorno senza orari (li decide il noleggiatore): conta come 1 giorno intero
  if (sp.dal && sp.dal === sp.al && !sp.ora_ritiro && !sp.ora_riconsegna) {
    pickup = romeToIso(sp.dal, "00:00");
    ret = romeToIso(addMonths(sp.dal, 0, 1), "00:00");
  }
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

  const results = await searchMap({
    bbox, lat: bbox ? undefined : lat, lng: bbox ? undefined : lng, radiusKm: 40, pickup, ret,
    category: cat, subcategory: cat && sp.sub && /^[a-z0-9-]{2,40}$/.test(sp.sub) ? sp.sub : undefined, make: make?.slug, model: model?.slug, filters, priceMaxCents: priceMax,
    sort: sp.ordina || "price_asc",   // di base sempre dal più economico
  });
  // breve / lungo termine: ogni annuncio dice cosa offre (senza dati: solo breve termine)
  const [offers, ratings] = await Promise.all([getOffers(results.map((r) => r.id)), getRatings(results.map((r) => r.id))]);
  const byTerm = results.filter((r) => { const o = offers.get(r.id); return lungo ? !!o?.long_term : !o || o.short_term; });
  const isSel = (id: string) => !!ratings.get(id)?.is_select;
  const shown = select ? byTerm.filter((r) => isSel(r.id)) : byTerm;
  const total = shown.length < results.length ? shown.length : Number(results[0]?.total_count ?? 0);
  const keep = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const items: ResultItem[] = shown.map((r) => ({ ...r, href: listingHref(r, keep), monthly_from_cents: lungo ? offers.get(r.id)?.lt_from_cents ?? null : undefined, ...ratings.get(r.id) }));
  // lungo termine: l'ordine per prezzo segue la rata mensile
  if (lungo && (sp.ordina || "price_asc").startsWith("price")) {
    const dir = sp.ordina === "price_desc" ? -1 : 1;
    items.sort((x, y) => ((x.monthly_from_cents ?? Infinity) - (y.monthly_from_cents ?? Infinity)) * dir || 0);
  }

  const where = bbox ? "nella zona della mappa" : sp.luogo && center ? (/^vicino a me$/i.test(sp.luogo) ? "vicino a te" : `vicino a ${sp.luogo}`) : "in Italia";
  const what = model ? `${make?.name} ${model.name}` : make?.name ?? categoryName(cat) ?? (select ? "Mezzi esclusivi" : "Mezzi");
  const when = sp.dal && sp.al && pickup ? `${formatDateIt(sp.dal)} → ${formatDateIt(sp.al)}` : "";
  const summary = [select ? "Select" : "", sp.kw ?? make?.name ?? categoryName(cat), sp.luogo || (bbox ? "Zona della mappa" : "Tutta Italia"), lungo ? `Lungo termine${sp.durata ? ` ${sp.durata} mesi` : ""}` : when].filter(Boolean).join(" · ");
  const activeFilters = Number(Boolean(make)) + Object.keys(filters).length + Number(Boolean(priceMax));
  const baseKeys = ["luogo", "lat", "lng", "zona", "dal", "al", "ora_ritiro", "ora_riconsegna", "cat", "sub", "lungo", "durata", "select"];
  // interruttore Standard / Select: stessa ricerca (luogo, date, mezzo, filtri), cambia solo select
  const modeHref = (on: boolean) => { const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["select", "pagina", "nonfound"].includes(k)) as [string, string][]); if (on) q.set("select", "1"); return `/cerca?${q.toString()}`; };

  const top = (
    <>
      <SaveSearch title={[sp.luogo || "Tutta Italia", what !== "Mezzi" ? what : ""].filter(Boolean).join(" · ")}
        sub={lungo ? `Lungo termine${sp.durata ? ` · ${sp.durata} mesi` : ""}` : when || "Date da scegliere"} />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-line bg-white p-1 sm:inline-grid sm:w-80" role="tablist" aria-label="Tipo di mezzi">
        <Link href={modeHref(false)} role="tab" aria-selected={!select}
          className={`rounded-full px-4 py-2 text-center text-sm font-bold tracking-wide transition ${!select ? "bg-navy-900 text-white" : "text-ink hover:bg-navy-50"}`}>STANDARD</Link>
        <Link href={modeHref(true)} role="tab" aria-selected={select}
          className={`rounded-full px-4 py-2 text-center text-sm font-bold tracking-wide transition ${select ? "bg-navy-950 text-amber-300" : "text-navy-950 hover:bg-navy-50"}`}>✦ SELECT</Link>
      </div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">{what} {where}</h1>
        <p className="text-sm text-mute">
          {total > MAP_LIMIT ? `primi ${MAP_LIMIT} di ${total}` : `${total} ${total === 1 ? "risultato" : "risultati"}`}
          {lungo ? " · noleggio a lungo termine, rata mensile" : pickup ? " · prezzi totali per le tue date" : ""}
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
                <select id="f-ordina" name="ordina" className="field" defaultValue={sp.ordina || "price_asc"}>
                  <option value="price_asc">Prezzo crescente</option>
                  <option value="price_desc">Prezzo decrescente</option>
                  {center && !bbox && <option value="distance">Distanza</option>}
                  <option value="relevance">Consigliati</option>
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
    <Shell sp={sp} summary={summary} cosa={sp.kw ?? (model ? `${make?.name} ${model.name}` : make?.name ?? categoryName(cat) ?? "")}>
      <ResultsView items={items} top={top} center={center} bbox={bbox} hasMap={hasMap} />
    </Shell>
  );
}

function Shell({ sp, summary, cosa, children }: { sp: Record<string, string | undefined>; summary: string; cosa?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="sticky top-16 z-20 border-b border-line bg-white lg:relative lg:top-0">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <SearchForm summary={summary}
            values={{ luogo: sp.luogo, lat: sp.lat, lng: sp.lng, dal: sp.dal, al: sp.al, cat: sp.cat, ora_ritiro: sp.ora_ritiro, ora_riconsegna: sp.ora_riconsegna, select: sp.select,
              // nel campo "Cosa": la parola cercata, altrimenti modello / marca / categoria in uso
              cosa: cosa ?? sp.kw ?? categoryName(sp.cat) ?? "" }} />
          {/* menu categorie scorrevole, come in home */}
          <nav aria-label="Categorie" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            {[{ key: "", label: "Tutti" }, ...CATEGORIES.filter((c) => !isSelectCategory(c.slug)).map((c) => ({ key: c.slug, label: c.name })),
              ...CATEGORIES.filter((c) => isSelectCategory(c.slug)).map((c) => ({ key: c.slug, label: c.name })), { key: "lungo", label: "Lungo termine" }]
            .map((p) => {
              // la scelta Standard / Select resta com'è
              const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["cat", "sub", "marca", "modello", "pagina", "lungo", "durata", "kw", "nonfound"].includes(k)) as [string, string][]);
              if (p.key === "lungo") { q.set("lungo", "1"); q.delete("al"); }
              else if (p.key) q.set("cat", p.key);
              const on = p.key === "lungo" ? sp.lungo === "1" : sp.lungo !== "1" && (sp.cat ?? "") === p.key;
              return (
                <Link key={p.key || "all"} href={`/cerca?${q.toString()}`} aria-current={on ? "page" : undefined}
                  className={`flex-none rounded-full border px-4 py-1.5 text-sm font-semibold transition ${on ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-ink hover:border-navy-900/30"}`}>
                  {p.label}
                </Link>
              );
            })}
          </nav>
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
