import { publicDb } from "@/lib/supabase/public";

/**
 * Ricerca per parola chiave ("Cosa cerchi?"): trasforma quello che scrive il cliente in filtri della ricerca.
 * Prima parole comuni (auto, gommone, autista, jet…), poi marche e modelli del catalogo (Ferrari, Ducato…).
 * Marche e categorie esclusive portano in KeyRent Select (lo fa /cerca).
 */
export type KeywordMatch = { cat?: string; marca?: string; modello?: string; select?: boolean; lungo?: boolean; label?: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const WORDS: [RegExp, KeywordMatch][] = [
  [/\b(lungo termine|noleggio lungo|nlt|a lungo)\b/, { lungo: true }],
  [/\b(ncc|autista|chauffeur|con conducente|transfer)\b/, { cat: "ncc" }],
  [/\b(jet|aereo|aerei|volo privato)\b/, { cat: "jet" }],
  [/\b(elicotter\w*|heli)\b/, { cat: "elicotteri" }],
  [/\b(supercar|lusso|luxury|sportiva di lusso|select)\b/, { cat: "auto", select: true }],
  [/\b(gommon\w*|barc\w*|yacht|motoscaf\w*|natant\w*|vela|catamaran\w*|imbarcazion\w*)\b/, { cat: "barche" }],
  [/\b(camper|motorhome|autocaravan\w*|caravan|roulotte)\b/, { cat: "camper" }],
  [/\b(furgon\w*|van|cassonat\w*|traslo\w*|pulmin\w*|minibus|9 posti)\b/, { cat: "furgoni" }],
  [/\b(quad|motoslitt\w*|atv)\b/, { cat: "quad-motoslitte" }],
  [/\b(e ?bike|bici\w*|mtb|mountain bike|biciclett\w*)\b/, { cat: "bici" }],
  [/\b(moto|scooter|motocicl\w*|motorino|vespa)\b/, { cat: "moto" }],
  [/\b(auto|macchin\w*|automobil\w*|suv|utilitaria|berlina|cabrio\w*|station wagon)\b/, { cat: "auto" }],
];

type Row = { slug: string; makes: { slug: string }; categories: { slug: string } };
/** Tra più risultati preferisce le auto (es. "BMW" fa auto e moto). */
const best = (rows: Row[]) => rows.find((r) => r.categories.slug === "auto") ?? rows[0];

export async function matchKeyword(raw?: string): Promise<KeywordMatch | null> {
  const q = norm(raw ?? "");
  if (!q) return null;
  const out: KeywordMatch = {};
  // 1) parole comuni (auto, gommone, autista, jet, lungo termine…)
  for (const [re, v] of WORDS) if (re.test(q)) { if (v.lungo) out.lungo = true; else if (!out.cat) Object.assign(out, v); }
  if (out.cat) return out;
  // 2) modello del catalogo ("ducato", "huracan", "fiat 500"), poi 3) marca ("ferrari", "bmw")
  const db = publicDb();
  const words = q.split(" ").filter((w) => w.length >= 2 && !/^(noleggio|noleggiare|affitto|a|da|di|per|con)$/.test(w));
  const tries = [...new Set([q, ...words])];
  for (const w of tries) {
    const { data } = await db.from("models").select("slug, makes!inner(slug), categories!inner(slug)")
      .or(`slug.like.${w.replace(/ /g, "-")}*,name.ilike.${w}*`).limit(20);
    const m = best((data ?? []) as unknown as Row[]);
    if (m) return { ...out, cat: m.categories.slug, marca: m.makes.slug, modello: m.slug };
  }
  for (const w of tries) {
    const { data } = await db.from("models").select("slug, makes!inner(slug), categories!inner(slug)")
      .or(`slug.like.${w.replace(/ /g, "-")}*,name.ilike.${w}*`, { referencedTable: "makes" }).limit(50);
    const m = best((data ?? []) as unknown as Row[]);
    if (m) return { ...out, cat: m.categories.slug, marca: m.makes.slug };
  }
  return Object.keys(out).length ? out : null;
}
