/** Categorie (allineate a supabase/seed.sql). Statiche per non interrogare il DB nella shell della pagina. */
export const CATEGORIES = [
  { slug: "auto", name: "Auto" },
  { slug: "moto", name: "Moto" },
  { slug: "bici", name: "Bici" },
  { slug: "camper", name: "Camper" },
  { slug: "barche", name: "Barche" },
  { slug: "furgoni", name: "Furgoni" },
  { slug: "quad-motoslitte", name: "Quad e motoslitte" },
] as const;

export function categoryName(slug?: string | null) {
  return CATEGORIES.find((c) => c.slug === slug)?.name;
}
