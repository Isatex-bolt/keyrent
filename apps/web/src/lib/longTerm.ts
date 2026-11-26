/* Noleggio a lungo termine: durate, servizi e lettura dal modulo (condiviso tra noleggiatore, admin e scheda pubblica). */
export const LT_DURATIONS = [12, 24, 36, 48] as const;
export const LT_SERVICES = [
  { key: "bollo", label: "Bollo" },
  { key: "assicurazione", label: "Assicurazione RCA e kasko" },
  { key: "gomme", label: "Gomme (estive/invernali)" },
  { key: "tagliandi", label: "Tagliandi e manutenzione" },
  { key: "sostitutiva", label: "Auto sostitutiva" },
] as const;
/** Fasce di km all'anno che il noleggiatore può offrire: per ognuna una rata diversa. */
export const LT_KM = [10000, 15000, 20000, 25000, 30000, 40000] as const;
export type LtService = { offered: boolean; cents: number };
/** Rate: { "36": { "15000": 45900 } } (vecchio formato { "36": 45900 } = rata per lt_km_per_year). */
export type LtPrices = Record<string, number | Record<string, number>>;
export type LongTermData = {
  short_term_enabled: boolean; long_term_enabled: boolean;
  lt_prices: LtPrices; lt_services: Record<string, LtService>;
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
  const prices: Record<string, Record<string, number>> = {};
  const services: Record<string, LtService> = {};
  const kms = new Set<number>();
  if (long) {
    for (const m of LT_DURATIONS) for (const k of LT_KM) {
      const v = c(f, `lt_price_${m}_${k}`);
      if (v > 0) { (prices[String(m)] ??= {})[String(k)] = v; kms.add(k); }
    }
    for (const sv of LT_SERVICES) services[sv.key] = { offered: s(f, `lt_srv_${sv.key}`) === "1", cents: c(f, `lt_srv_${sv.key}_price`) };
  }
  // km "base" dell'offerta = la fascia più bassa con una rata
  const km = kms.size ? Math.min(...kms) : 0;
  const data: LongTermData = {
    short_term_enabled: short || !long, long_term_enabled: long, lt_prices: prices, lt_services: services,
    lt_km_per_year: long && km > 0 ? km : null, lt_extra_km_cents: long ? c(f, "lt_extra_km") || null : null,
  };
  if (long && !Object.keys(prices).length) return { data, error: "Lungo termine: indica la rata mensile per almeno una durata e una fascia di km." };
  return { data };
}

/** Rate per durata come { km: cents }, anche dal vecchio formato (una sola fascia = lt_km_per_year). */
export function ratesFor(prices: LtPrices | null | undefined, months: number, baseKm: number | null): Record<string, number> {
  const v = prices?.[String(months)];
  if (typeof v === "number") return v > 0 && baseKm ? { [String(baseKm)]: v } : {};
  return Object.fromEntries(Object.entries(v ?? {}).filter(([, x]) => Number(x) > 0)) as Record<string, number>;
}
/** Fasce di km offerte per una durata, in ordine. */
export function kmFor(prices: LtPrices | null | undefined, months: number, baseKm: number | null): number[] {
  return Object.keys(ratesFor(prices, months, baseKm)).map(Number).sort((a, b) => a - b);
}

/** Rata mensile per durata, km annui e servizi scelti (i servizi a 0 € sono inclusi). */
export function monthlyRate(prices: LtPrices, services: Record<string, LtService>, months: number, chosen: string[], km: number, baseKm: number | null) {
  const base = ratesFor(prices, months, baseKm)[String(km)] ?? 0;
  if (!base) return 0;
  return base + LT_SERVICES.reduce((sum, sv) => {
    const x = services[sv.key];
    return x?.offered && chosen.includes(sv.key) ? sum + (x.cents || 0) : sum;
  }, 0);
}
