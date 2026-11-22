import "server-only";
import { serviceDb } from "./supabase/admin";
import { CATALOG, EXTRA_SUBCATEGORIES, findCatalog, type CatalogEntry } from "@/data/catalog";

async function categoryIds() {
  const { data, error } = await serviceDb().from("categories").select("id, slug");
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((c) => [c.slug as string, c.id as string]));
}

async function ensureSubcategories(cats: Map<string, string>) {
  const rows = Object.entries(EXTRA_SUBCATEGORIES).flatMap(([cat, subs]) =>
    subs.map((s) => ({ category_id: cats.get(cat), slug: s.slug, name_it: s.name, sort: s.sort })))
    .filter((r) => r.category_id);
  if (rows.length) {
    const { error } = await serviceDb().from("subcategories").upsert(rows, { onConflict: "category_id,slug", ignoreDuplicates: true });
    if (error) throw new Error(`Tipologie: ${error.message}`);
  }
}

async function upsertEntries(entries: CatalogEntry[]) {
  const db = serviceDb();
  const cats = await categoryIds();
  await ensureSubcategories(cats);
  const makes = [...new Map(entries.map((e) => [e.makeSlug, { slug: e.makeSlug, name: e.make }])).values()];
  const { error: mErr } = await db.from("makes").upsert(makes, { onConflict: "slug", ignoreDuplicates: true });
  if (mErr) throw new Error(`Marche: ${mErr.message}`);
  const { data: makeRows, error: rErr } = await db.from("makes").select("id, slug").in("slug", makes.map((m) => m.slug));
  if (rErr) throw new Error(rErr.message);
  const makeId = new Map((makeRows ?? []).map((m) => [m.slug as string, m.id as string]));
  const rows = entries.map((e) => ({ make_id: makeId.get(e.makeSlug), category_id: cats.get(e.category), slug: e.modelSlug, name: e.model }))
    .filter((r) => r.make_id && r.category_id);
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await db.from("models").upsert(rows.slice(i, i + 250), { onConflict: "make_id,category_id,slug", ignoreDuplicates: true });
    if (error) throw new Error(`Modelli: ${error.message}`);
  }
  return { makes: makes.length, models: rows.length };
}

/** Allinea il database al catalogo del sito (aggiunge ciò che manca, non cancella nulla). */
export async function syncCatalog() {
  return upsertEntries(CATALOG);
}

/** Usato alla creazione di un annuncio: se il modello è nel catalogo ma non ancora nel database, lo crea. */
export async function ensureCatalogEntry(category: string, makeSlug: string, modelSlug: string) {
  const e = findCatalog(category, makeSlug, modelSlug);
  if (e) await upsertEntries([e]);
  else if (EXTRA_SUBCATEGORIES[category]) await ensureSubcategories(await categoryIds());
}
