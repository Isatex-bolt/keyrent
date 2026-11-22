const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function euro(cents: number | null | undefined, decimals = false) {
  if (cents == null) return "—";
  return (decimals ? eur2 : eur).format(cents / 100);
}

export const priceUnitLabel: Record<string, string> = {
  hour: "ora",
  half_day: "mezza giornata",
  day: "giorno",
  week: "settimana",
};

/** Converte data (YYYY-MM-DD) + ora (HH:MM) del fuso Europe/Rome in ISO UTC. */
export function romeToIso(date: string, time = "10:00"): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // prima stima in UTC, poi correggo con l'offset reale di Roma in quel momento (gestisce l'ora legale)
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asRome = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = asRome - guess;
  const ts = guess - offset;
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

export function todayRome(addDays = 0): string {
  const d = new Date(Date.now() + addDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
}

export function formatDateIt(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Durata del noleggio a parole: "Prenotazione per 31 giorni" (anche con tariffa settimanale). */
export function durationLabel(qty: number, unit: string) {
  if (unit === "hour") return `Prenotazione per ${qty} ${qty === 1 ? "ora" : "ore"}`;
  if (unit === "half_day") return qty === 1 ? "Prenotazione per mezza giornata" : `Prenotazione per ${qty} mezze giornate`;
  return `Prenotazione per ${qty} ${qty === 1 ? "giorno" : "giorni"}`;
}
