import { publicDb, mediaUrl } from "./supabase/public";

export type SearchParams = {
  luogo?: string; dal?: string; al?: string; ora_ritiro?: string; ora_riconsegna?: string;
  cat?: string; marca?: string; modello?: string; prezzo_max?: string; ordina?: string; pagina?: string;
  [attr: string]: string | undefined;
};

export type SearchResult = {
  id: string; slug: string; title: string; category_slug: string; make_name: string | null; model_name: string | null;
  city: string; province: string; price_from_cents: number | null; distance_km: number | null;
  available_units: number; total_count: number; cover: string | null; cover_indicative?: boolean;
};

export type AttributeDef = {
  key: string; label_it: string; data_type: "number" | "text" | "enum" | "boolean";
  unit: string | null; options: string[] | null; filterable: boolean; sort: number;
};

export const PAGE_SIZE = 24;

export async function searchListings(args: {
  lat?: number; lng?: number; radiusKm?: number; pickup?: string | null; ret?: string | null;
  category?: string; make?: string; model?: string; filters?: Record<string, unknown>;
  priceMaxCents?: number; sort?: string; page?: number;
}): Promise<SearchResult[]> {
  const db = publicDb();
  const { data, error } = await db.rpc("search_listings", {
    p_lat: args.lat ?? null, p_lng: args.lng ?? null, p_radius_km: args.radiusKm ?? 40,
    p_pickup: args.pickup ?? null, p_return: args.ret ?? null,
    p_category: args.category ?? null, p_make: args.make ?? null, p_model: args.model ?? null,
    p_filters: args.filters ?? {}, p_price_max_cents: args.priceMaxCents ?? null,
    p_sort: args.sort ?? "relevance", p_limit: PAGE_SIZE, p_offset: ((args.page ?? 1) - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`Ricerca non riuscita: ${error.message}`);
  const rows = (data ?? []) as Omit<SearchResult, "cover">[];
  const cov = await covers(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, cover: cov.get(r.id)?.url ?? null, cover_indicative: cov.get(r.id)?.indicative ?? false }));
}

async function coverImages(ids: string[]) {
  const map = new Map<string, { url: string; indicative: boolean }>();
  if (ids.length === 0) return map;
  let res = await publicDb().from("public_listing_media").select("listing_id, storage_path, sort, is_indicative")
    .in("listing_id", ids).order("sort");
  if (res.error) res = await publicDb().from("public_listing_media").select("listing_id, storage_path, sort")
    .in("listing_id", ids).order("sort") as typeof res;
  for (const m of res.data ?? []) if (!map.has(m.listing_id)) map.set(m.listing_id, { url: mediaUrl(m.storage_path), indicative: !!m.is_indicative });
  return map;
}

type CatalogKey = { category_slug: string; make_slug: string | null; model_slug: string | null };

/** Immagine indicativa di catalogo: prima quella del modello, poi quella generica della categoria. */
export async function catalogImages(keys: CatalogKey[]) {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const cats = [...new Set(keys.map((k) => k.category_slug))];
  const { data, error } = await publicDb().from("public_catalog_images")
    .select("category_slug, make_slug, model_slug, storage_path").in("category_slug", cats);
  if (error) return out; // tabella non ancora installata: nessuna immagine indicativa
  const byKey = new Map<string, string>();
  for (const r of data ?? []) byKey.set(`${r.category_slug}|${r.make_slug ?? ""}|${r.model_slug ?? ""}`, mediaUrl(r.storage_path));
  for (const k of keys) {
    const img = byKey.get(`${k.category_slug}|${k.make_slug ?? ""}|${k.model_slug ?? ""}`) ?? byKey.get(`${k.category_slug}||`);
    if (img) out.set(`${k.category_slug}|${k.make_slug ?? ""}|${k.model_slug ?? ""}`, img);
  }
  return out;
}

/** Copertina per ogni annuncio: prima foto vera, altrimenti immagine indicativa di catalogo. */
export async function covers(ids: string[]) {
  const real = await coverImages(ids);
  const missing = ids.filter((id) => !real.has(id));
  const result = new Map<string, { url: string; indicative: boolean }>();
  for (const [id, v] of real) result.set(id, v);
  if (missing.length === 0) return result;
  const { data } = await publicDb().from("public_listings").select("id, category_slug, make_slug, model_slug").in("id", missing);
  const keys = (data ?? []) as (CatalogKey & { id: string })[];
  const imgs = await catalogImages(keys);
  for (const k of keys) {
    const url = imgs.get(`${k.category_slug}|${k.make_slug ?? ""}|${k.model_slug ?? ""}`);
    if (url) result.set(k.id, { url, indicative: true });
  }
  return result;
}

export async function makesForCategory(category: string) {
  const { data, error } = await publicDb().from("models")
    .select("slug, name, makes!inner(slug, name), categories!inner(slug)")
    .eq("categories.slug", category).order("name");
  if (error) throw new Error(error.message);
  type Row = { slug: string; name: string; makes: { slug: string; name: string } };
  const makes = new Map<string, { slug: string; name: string; models: { slug: string; name: string }[] }>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const m = makes.get(r.makes.slug) ?? { slug: r.makes.slug, name: r.makes.name, models: [] };
    m.models.push({ slug: r.slug, name: r.name });
    makes.set(m.slug, m);
  }
  return [...makes.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export async function attributesForCategory(category: string): Promise<AttributeDef[]> {
  const { data, error } = await publicDb().from("attribute_definitions")
    .select("key, label_it, data_type, unit, options, filterable, sort, categories!inner(slug)")
    .eq("categories.slug", category).order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AttributeDef[];
}

export async function getListing(id: string) {
  const db = publicDb();
  const [listing, media, prices, extras] = await Promise.all([
    db.from("public_listings").select("*").eq("id", id).maybeSingle(),
    db.from("public_listing_media").select("*").eq("listing_id", id).order("sort"),
    db.from("public_listing_prices").select("unit, price_cents, valid_from, valid_to").eq("listing_id", id),
    db.from("public_listing_extras").select("id, name, price_cents, charge, max_qty").eq("listing_id", id),
  ]);
  if (listing.error) throw new Error(listing.error.message);
  if (!listing.data) return null;
  let gallery = (media.data ?? []).map((m) => ({ url: mediaUrl(m.storage_path), alt: m.alt as string | null }));
  let indicative = (media.data ?? []).length > 0 && (media.data ?? []).every((m) => m.is_indicative);
  if (gallery.length === 0) {
    const l = listing.data as CatalogKey;
    const img = (await catalogImages([l])).get(`${l.category_slug}|${l.make_slug ?? ""}|${l.model_slug ?? ""}`);
    if (img) { gallery = [{ url: img, alt: null }]; indicative = true; }
  }
  return {
    listing: listing.data as Record<string, any>,
    media: gallery,
    indicative,
    prices: (prices.data ?? []) as { unit: string; price_cents: number; valid_from: string | null; valid_to: string | null }[],
    extras: (extras.data ?? []) as { id: string; name: string; price_cents: number; charge: string; max_qty: number }[],
  };
}

export async function getCancellationRules(policyId: string | null) {
  const db = publicDb();
  let q = db.from("cancellation_policy_versions").select("rules, version, cancellation_policies!inner(code)")
    .order("version", { ascending: false }).limit(1);
  q = policyId ? q.eq("policy_id", policyId) : q.eq("cancellation_policies.code", "standard");
  const { data } = await q.maybeSingle();
  return (data?.rules ?? null) as null | { before_confirmation_fee_pct?: number; tiers?: { min_hours_before: number; fee_pct: number }[]; provider_cancel_refund_pct?: number };
}

export type Quote = { total_cents: number; base_cents: number; unit: string; qty: number; days: number };

export async function getQuote(id: string, pickup: string, ret: string): Promise<Quote | null> {
  const r = await quoteOrError(id, pickup, ret);
  return "error" in r ? null : r;
}

/** Preventivo con il motivo, in italiano, quando non si può calcolare. */
export async function quoteOrError(id: string, pickup: string, ret: string): Promise<Quote | { error: string }> {
  if (ret <= pickup) return { error: "La riconsegna deve essere dopo il ritiro: scegli un orario o un giorno successivo." };
  const { data, error } = await publicDb().rpc("quote", { p_listing: id, p_pickup: pickup, p_return: ret, p_extras: [] });
  if (!error) return data as Quote;
  if (/NO_PRICE/.test(error.message)) return { error: "Il noleggiatore non ha una tariffa per questa durata: prova un periodo più lungo o più corto." };
  if (/INVALID_RANGE/.test(error.message)) return { error: "La riconsegna deve essere dopo il ritiro." };
  return { error: "Non riusciamo a calcolare il prezzo per queste date: riprova." };
}

export async function getBusyDays(id: string, from: string, to: string) {
  const { data } = await publicDb().rpc("listing_busy_days", { p_listing: id, p_from: from, p_to: to });
  return new Set(((data ?? []) as { day: string }[]).map((d) => d.day));
}

export type MapResult = SearchResult & {
  approx_latitude: number | null; approx_longitude: number | null;
  instant_book: boolean; total_cents: number | null;
};

export const MAP_LIMIT = 60;

/**
 * Ricerca per la mappa: area visibile (bbox) oppure centro+raggio, con totale per le date.
 * Se la funzione search_map non è ancora installata nel database, ripiega su search_listings.
 */
export async function searchMap(args: {
  bbox?: [number, number, number, number] | null; lat?: number; lng?: number; radiusKm?: number;
  pickup?: string | null; ret?: string | null; category?: string; subcategory?: string; make?: string; model?: string;
  filters?: Record<string, unknown>; priceMaxCents?: number; instantOnly?: boolean; sort?: string; limit?: number;
}): Promise<MapResult[]> {
  const db = publicDb();
  const [w, s, e, n] = args.bbox ?? [null, null, null, null];
  const { data, error } = await db.rpc("search_map", {
    p_west: w, p_south: s, p_east: e, p_north: n,
    p_lat: args.lat ?? null, p_lng: args.lng ?? null, p_radius_km: args.radiusKm ?? 40,
    p_pickup: args.pickup ?? null, p_return: args.ret ?? null,
    p_category: args.category ?? null, p_subcategory: args.subcategory ?? null, p_make: args.make ?? null, p_model: args.model ?? null,
    p_filters: args.filters ?? {}, p_price_max_cents: args.priceMaxCents ?? null,
    p_instant_only: args.instantOnly ?? false, p_sort: args.sort ?? "relevance", p_limit: args.limit ?? MAP_LIMIT,
  });
  let rows: Omit<MapResult, "cover">[];
  if (error) {
    if (!/search_map|PGRST202|function/i.test(`${error.code} ${error.message}`)) throw new Error(`Ricerca non riuscita: ${error.message}`);
    const old = await db.rpc("search_listings", {
      p_lat: args.lat ?? null, p_lng: args.lng ?? null, p_radius_km: args.radiusKm ?? 40,
      p_pickup: args.pickup ?? null, p_return: args.ret ?? null,
      p_category: args.category ?? null, p_make: args.make ?? null, p_model: args.model ?? null,
      p_filters: args.filters ?? {}, p_price_max_cents: args.priceMaxCents ?? null,
      p_sort: args.sort ?? "relevance", p_limit: MAP_LIMIT, p_offset: 0,
    });
    if (old.error) throw new Error(`Ricerca non riuscita: ${old.error.message}`);
    rows = ((old.data ?? []) as Omit<MapResult, "cover" | "instant_book" | "total_cents">[])
      .map((r) => ({ ...r, instant_book: false, total_cents: null }));
  } else {
    rows = (data ?? []) as Omit<MapResult, "cover">[];
  }
  const cov = await covers(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, cover: cov.get(r.id)?.url ?? null, cover_indicative: cov.get(r.id)?.indicative ?? false }));
}

/** Consegna a domicilio di un annuncio pubblicato (null se non attiva o database non aggiornato). */
export async function getDelivery(id: string): Promise<{ radius_km: number; fee_cents: number; per_km_cents: number } | null> {
  const { data, error } = await publicDb().rpc("listing_delivery", { p_listing: id });
  const row = !error && Array.isArray(data) ? (data[0] as { enabled: boolean; radius_km: number; fee_cents: number; per_km_cents: number } | undefined) : undefined;
  return row?.enabled ? { radius_km: row.radius_km, fee_cents: row.fee_cents, per_km_cents: row.per_km_cents } : null;
}

/** Prezzo della consegna dalla posizione del cliente (calcolato dal database: distanza dalla sede). */
export async function getDeliveryQuote(id: string, lat: number, lng: number): Promise<{ km: number; cents: number | null; in_range: boolean; radius_km: number } | null> {
  const { data, error } = await publicDb().rpc("delivery_quote", { p_listing: id, p_lat: lat, p_lng: lng });
  return !error && Array.isArray(data) && data[0] ? data[0] : null;
}

/** Annuncio dell'account di prova (nessuna prenotazione vera). Senza la migrazione 0025: false. */
export async function getIsDemo(id: string): Promise<boolean> {
  const { data, error } = await publicDb().rpc("listing_is_demo", { p_listing: id });
  return !error && data === true;
}

export type Offer = { listing_id: string; short_term: boolean; long_term: boolean; lt_prices: Record<string, number>;
  lt_services: Record<string, { offered: boolean; cents: number }>; lt_km_per_year: number | null; lt_extra_km_cents: number | null; lt_from_cents: number | null };
/** Breve / lungo termine degli annunci pubblicati (mappa vuota se il database non è aggiornato). */
export async function getOffers(ids: string[]): Promise<Map<string, Offer>> {
  if (!ids.length) return new Map();
  const { data, error } = await publicDb().rpc("listing_offers", { p_ids: ids });
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as Offer[]).map((o) => [o.listing_id, o]));
}

export type ProviderReviews = { count: number; avg: number | null; items: { rating: number; body: string; created_at: string; title: string; author: string }[] };
/** Recensioni dei clienti sul noleggiatore (su tutti i suoi annunci pubblici); il noleggiatore resta anonimo. */
export async function getProviderReviews(id: string): Promise<ProviderReviews> {
  const { data, error } = await publicDb().rpc("provider_reviews", { p_listing: id, p_limit: 6 });
  if (error || !data) return { count: 0, avg: null, items: [] };
  return data as ProviderReviews;
}

export type Rating = { rating_avg: number | null; rating_count: number; premium: boolean };
/** Voto/recensioni di ogni annuncio e noleggiatore Premium, per le schede dei risultati (vuoto se il database non è aggiornato). */
export async function getRatings(ids: string[]): Promise<Map<string, Rating>> {
  if (!ids.length) return new Map();
  const { data, error } = await publicDb().rpc("listing_ratings", { p_ids: ids });
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as (Rating & { listing_id: string })[]).map((r) => [r.listing_id, { rating_avg: r.rating_avg != null ? Number(r.rating_avg) : null, rating_count: Number(r.rating_count), premium: !!r.premium }]));
}
