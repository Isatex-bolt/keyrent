import type { DayState } from "@/lib/v2/fleet";

/** ANTEPRIMA V2 — elementi grafici condivisi (calendari, KPI, legenda). */
export const STATE: Record<DayState, { cell: string; dot: string; label: string }> = {
  free:    { cell: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", label: "Disponibile" },
  partial: { cell: "bg-emerald-50 text-emerald-900 ring-amber-300", dot: "bg-gradient-to-r from-emerald-500 to-red-500", label: "Parzialmente occupato" },
  booked:  { cell: "bg-red-500 text-white ring-red-500", dot: "bg-red-500", label: "Prenotato" },
  pending: { cell: "bg-amber-100 text-amber-900 ring-amber-300", dot: "bg-amber-400", label: "In attesa / bloccato" },
  off:     { cell: "bg-slate-200 text-slate-500 ring-slate-200", dot: "bg-slate-400", label: "Non disponibile" },
};

export function Legend({ pool = false }: { pool?: boolean }) {
  const keys: DayState[] = pool ? ["free", "partial", "booked", "pending", "off"] : ["free", "booked", "pending", "off"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-mute">
      {keys.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${STATE[k].dot}`} />{STATE[k].label}</span>
      ))}
    </div>
  );
}

export function Kpi({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint?: string; tone?: "default" | "alert" | "good" }) {
  const ring = tone === "alert" ? "ring-1 ring-amber-300 bg-amber-50/60" : tone === "good" ? "bg-teal-50/60" : "bg-white";
  return (
    <div className={`min-w-[150px] snap-start rounded-2xl border border-line p-4 transition hover:-translate-y-0.5 hover:shadow-md ${ring}`}>
      <p className="text-xs font-medium text-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-navy-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export const WEEKDAY = ["L", "M", "M", "G", "V", "S", "D"];
export const dayNum = (d: string) => Number(d.slice(8, 10));
/** 0 = lunedì */
export const weekday = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
export const monthLabel = (mese: string) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mese}-01T12:00:00Z`));
export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso));
export const euroShort = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c / 100);

export function DemoNote({ reason }: { reason: "demo" | "no-login" | "no-provider" }) {
  const text = reason === "demo" ? "Stai vedendo dati di esempio (?demo=1): niente di tutto questo esiste nel database."
    : reason === "no-login" ? "Non hai fatto l'accesso: vedi dati di esempio. Accedi come noleggiatore per vedere i tuoi."
    : "Questo account non ha un'attività: vedi dati di esempio.";
  return <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-950">🧪 {text}</p>;
}

export const LISTING_LABEL: Record<string, string> = {
  published: "Pubblicato", pending_review: "In approvazione", changes_required: "Modifiche richieste", approved: "Approvato",
  suspended: "Sospeso", unpublished: "Non pubblicato", rejected: "Rifiutato", draft: "Bozza",
};
