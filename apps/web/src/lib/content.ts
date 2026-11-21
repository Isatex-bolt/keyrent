import { publicDb, mediaUrl } from "./supabase/public";

export type Collection = { slug: string; title: string; subtitle: string; query: string; image: string | null };
export type Destination = {
  slug: string; name: string; region: string; tagline: string; description: string;
  latitude: number; longitude: number; radius_km: number; categories: string[]; image: string | null;
};

/** Esigenze della home. Se la tabella non è ancora installata restituisce un elenco vuoto. */
export async function getCollections(): Promise<Collection[]> {
  const { data, error } = await publicDb().from("home_collections").select("slug, title, subtitle, query, image_path").order("sort");
  if (error) return [];
  return (data ?? []).map((c) => ({ ...c, image: c.image_path ? mediaUrl(c.image_path) : null }));
}

export async function getDestinations(): Promise<Destination[]> {
  const { data, error } = await publicDb().from("destinations").select("*").order("sort");
  if (error) return [];
  return (data ?? []).map((d) => ({ ...d, image: d.image_path ? mediaUrl(d.image_path) : null })) as Destination[];
}

export async function getDestination(slug: string): Promise<Destination | null> {
  const { data } = await publicDb().from("destinations").select("*").eq("slug", slug).maybeSingle();
  return data ? ({ ...data, image: data.image_path ? mediaUrl(data.image_path) : null } as Destination) : null;
}

export function destinationSearchHref(d: Destination, cat?: string) {
  const q = new URLSearchParams({ luogo: d.name, lat: String(d.latitude), lng: String(d.longitude) });
  if (cat) q.set("cat", cat);
  return `/cerca?${q}`;
}

/** Colori di riserva finché non c'è una foto. */
export const TILE_GRADIENT: Record<string, string> = {
  "escursione-in-bici": "from-emerald-700 via-teal-600 to-teal-400",
  "sei-in-viaggio": "from-navy-900 via-navy-700 to-sky-500",
  "weekend-in-camper": "from-amber-600 via-orange-500 to-rose-400",
  "giornata-in-barca": "from-sky-700 via-cyan-500 to-teal-300",
  "mezzo-per-azienda": "from-slate-800 via-slate-600 to-slate-400",
  avventura: "from-indigo-900 via-indigo-600 to-sky-300",
};
export const TILE_EMOJI: Record<string, string> = {
  "escursione-in-bici": "🚵", "sei-in-viaggio": "✈️", "weekend-in-camper": "🚐",
  "giornata-in-barca": "⛵", "mezzo-per-azienda": "🏢", avventura: "🏔️",
};
