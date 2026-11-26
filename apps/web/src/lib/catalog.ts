/** Categorie (allineate a supabase/seed.sql). Statiche per non interrogare il DB nella shell della pagina. */
export const CATEGORIES = [
  { slug: "auto", name: "Auto" },
  { slug: "moto", name: "Moto" },
  { slug: "bici", name: "Bici" },
  { slug: "camper", name: "Camper" },
  { slug: "barche", name: "Barche" },
  { slug: "furgoni", name: "Furgoni" },
  { slug: "quad-motoslitte", name: "Quad e motoslitte" },
  { slug: "ncc", name: "NCC con autista" },
  { slug: "jet", name: "Jet privati" },
  { slug: "elicotteri", name: "Elicotteri" },
] as const;

/** Categorie solo KeyRent Select: non compaiono nella ricerca normale. */
export const SELECT_CATEGORIES = ["ncc", "jet", "elicotteri"];
export const isSelectCategory = (slug?: string | null) => !!slug && SELECT_CATEGORIES.includes(slug);
/** Categorie di servizi a ore (con equipaggio/autista): prezzo "da X / ora" e niente patente. */
export const isHourlyCategory = (slug?: string | null) => isSelectCategory(slug);

export function categoryName(slug?: string | null) {
  return CATEGORIES.find((c) => c.slug === slug)?.name;
}
