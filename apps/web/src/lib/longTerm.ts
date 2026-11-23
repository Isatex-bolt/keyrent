/* Noleggio a lungo termine: durate, servizi e lettura dal modulo (condiviso tra noleggiatore, admin e scheda pubblica). */
export const LT_DURATIONS = [12, 24, 36, 48] as const;
export const LT_SERVICES = [
  { key: "bollo", label: "Bollo" },
  { key: "assicurazione", label: "Assicurazione RCA e kasko" },
  { key: "gomme", label: "Gomme (estive/invernali)" },
  { key: "tagliandi", label: "Tagliandi e manutenzione" },
  { key: "sostitutiva", label: "Auto sostitutiva" },
] as const;
export type LtService = { offered: boolean; cents: number };
export type LongTermData = {
  short_term_enabled: boolean; long_term_enabled: boolean;
  lt_prices: Record<string, number>; lt_services: Record<string, LtService>;
  lt_km_per_year: number | null; lt_extra_km_cents: number | null;
};

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const c = (f: FormData, k: string) => {
  const v = Number(s(f, k).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
};

/** Modalità di noleggio e offerta a lungo termine dal modulo. Errore in parole semplici se mancano dati obbligatori. */
export function longTermOf(f: FormData): { data: LongTermData; error?: string } {
  const short = s(f, "mode_short") === "1";
  const long = s(f, "mode_long") === "1";
  const prices: Record<string, number> = {};
  const services: Record<string, LtService> = {};
  if (long) {
    for (const m of LT_DURATIONS) { const v = c(f, `lt_price_${m}`); if (v > 0) prices[String(m)] = v; }
    for (const sv of LT_SERVICES) services[sv.key] = { offered: s(f, `lt_srv_${sv.key}`) === "1", cents: c(f, `lt_srv_${sv.key}_price`) };
  }
  const km = long ? Math.round(Number(s(f, "lt_km_per_year")) || 0) : 0;
  const data: LongTermData = {
    short_term_enabled: short || !long, long_term_enabled: long, lt_prices: prices, lt_services: services,
    lt_km_per_year: long && km > 0 ? km : null, lt_extra_km_cents: long ? c(f, "lt_extra_km") || null : null,
  };
  if (long && !Object.keys(prices).length) return { data, error: "Lungo termine: indica la rata mensile per almeno una durata." };
  if (long && !km) return { data, error: "Lungo termine: indica i km all'anno inclusi." };
  return { data };
}

/** Rata mensile per durata e servizi scelti (i servizi a 0 € sono inclusi). */
export function monthlyRate(prices: Record<string, number>, services: Record<string, LtService>, months: number, chosen: string[]) {
  const base = prices[String(months)] ?? 0;
  if (!base) return 0;
  return base + LT_SERVICES.reduce((sum, sv) => {
    const x = services[sv.key];
    return x?.offered && chosen.includes(sv.key) ? sum + (x.cents || 0) : sum;
  }, 0);
}
