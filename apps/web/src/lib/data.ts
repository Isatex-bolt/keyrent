import { publicDb, mediaUrl } from "./supabase/public";

export type SearchParams = {
  luogo?: string; dal?: string; al?: string; ora_ritiro?: string; ora_riconsegna?: string;
  cat?: string; marca?: string; modello?: string; prezzo_max?: string; ordina?: string; pagina?: string;
  [attr: string]: string | undefined;
};

export type SearchResult = {
  id: string; slug: string; title: string; category_slug: string; make_name: string | null; model_name: string | null;
  city: string; province: string; price_from_cents: number | null; distance_km: number | null;
  available_units: number; total_count: number; cover: string | null;
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
  const covers = await coverImages(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, cover: covers.get(r.id) ?? null }));
}

async function coverImages(ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await publicDb().from("public_listing_media").select("listing_id, storage_path, sort")
    .in("listing_id", ids).order("sort");
  for (const m of data ?? []) if (!map.has(m.listing_id)) map.set(m.listing_id, mediaUrl(m.storage_path));
  return map;
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
    db.from("public_listing_media").select("storage_path, alt, sort").eq("listing_id", id).order("sort"),
    db.from("public_listing_prices").select("unit, price_cents, valid_from, valid_to").eq("listing_id", id),
    db.from("public_listing_extras").select("id, name, price_cents, charge, max_qty").eq("listing_id", id),
  ]);
  if (listing.error) throw new Error(listing.error.message);
  if (!listing.data) return null;
  return {
    listing: listing.data as Record<string, any>,
    media: (media.data ?? []).map((m) => ({ url: mediaUrl(m.storage_path), alt: m.alt as string | null })),
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

export async function getQuote(id: string, pickup: string, ret: string) {
  const { data, error } = await publicDb().rpc("quote", { p_listing: id, p_pickup: pickup, p_return: ret, p_extras: [] });
  if (error) return null;
  return data as { total_cents: number; base_cents: number; unit: string; qty: number; days: number };
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
  pickup?: string | null; ret?: string | null; category?: string; make?: string; model?: string;
  filters?: Record<string, unknown>; priceMaxCents?: number; instantOnly?: boolean; sort?: string;
}): Promise<MapResult[]> {
  const db = publicDb();
  const [w, s, e, n] = args.bbox ?? [null, null, null, null];
  const { data, error } = await db.rpc("search_map", {
    p_west: w, p_south: s, p_east: e, p_north: n,
    p_lat: args.lat ?? null, p_lng: args.lng ?? null, p_radius_km: args.radiusKm ?? 40,
    p_pickup: args.pickup ?? null, p_return: args.ret ?? null,
    p_category: args.category ?? null, p_make: args.make ?? null, p_model: args.model ?? null,
    p_filters: args.filters ?? {}, p_price_max_cents: args.priceMaxCents ?? null,
    p_instant_only: args.instantOnly ?? false, p_sort: args.sort ?? "relevance", p_limit: MAP_LIMIT,
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
  const covers = await coverImages(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, cover: covers.get(r.id) ?? null }));
}
