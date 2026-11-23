import Link from "next/link";
import type { CustomerData, Rental } from "@/lib/v2/customer";

export const eur = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c / 100);
export const when = (iso: string) => new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso));
export const hour = (iso: string) => new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso));
export function relDay(iso: string) {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
  const t = fmt(new Date()), d = fmt(new Date(iso)), tm = fmt(new Date(Date.now() + 86_400_000));
  return d === t ? "oggi" : d === tm ? "domani" : new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(new Date(iso));
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  requested: { label: "In attesa di conferma", tone: "bg-amber-50 text-amber-800" },
  accepted: { label: "Disponibilità confermata", tone: "bg-teal-50 text-teal-700" },
  confirmed: { label: "Confermata", tone: "bg-emerald-50 text-emerald-800" },
  picked_up: { label: "In corso", tone: "bg-navy-900 text-white" },
  completed: { label: "Conclusa", tone: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancellata", tone: "bg-red-50 text-red-700" },
  declined: { label: "Non disponibile", tone: "bg-red-50 text-red-700" },
  expired: { label: "Scaduta", tone: "bg-slate-100 text-slate-600" },
};

/** Link interni che mantengono ?demo e ?contesto */
export function qs(sp: Record<string, string | string[] | undefined>, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const k of ["demo", "contesto"]) if (typeof sp[k] === "string") p.set(k, sp[k] as string);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function Thumb({ r, className = "h-16 w-16" }: { r: { cover: string | null; category?: string; title?: string }; className?: string }) {
  return r.cover
    ? <img src={r.cover} alt="" className={`${className} shrink-0 rounded-xl object-cover`} />
    : <span className={`${className} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-navy-50 to-teal-50 text-[10px] font-semibold uppercase tracking-wider text-navy-700/60`}>{r.category ?? ""}</span>;
}

export function RentalRow({ r, href }: { r: Rental; href: string }) {
  const s = STATUS[r.status] ?? { label: r.status, tone: "bg-slate-100" };
  return (
    <Link href={href} className="flex gap-3 rounded-2xl border border-line bg-white p-3 transition active:scale-[0.99] hover:shadow-md">
      <Thumb r={r} className="h-20 w-20" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-navy-900">{r.title}</p>
          <span className="shrink-0 font-semibold">{eur(r.totalCents)}</span>
        </div>
        <p className="truncate text-xs text-mute">{r.category} · {r.city}</p>
        <p className="mt-1 text-sm">{when(r.pickupAt)} → {when(r.returnAt)}</p>
        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>{s.label}</span>
      </div>
    </Link>
  );
}

export function DemoBar({ c, sp }: { c: CustomerData; sp: Record<string, string | string[] | undefined> }) {
  if (!c.demo) return null;
  return (
    <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
      {c.loggedIn ? "Dati di esempio (?demo=1)." : "Non hai fatto l'accesso: vedi dati di esempio."}
      {" "}<Link href={`?${new URLSearchParams({ ...(sp.demo === "1" ? { demo: "1" } : {}), contesto: c.context === "azienda" ? "personale" : "azienda" })}`} className="font-semibold underline">
        Prova come {c.context === "azienda" ? "privato" : "azienda"}
      </Link>
    </p>
  );
}

/** Interruttore Personale / Azienda */
export function ContextSwitch({ c, sp }: { c: CustomerData; sp: Record<string, string | string[] | undefined> }) {
  if (!c.business) return null;
  const href = (v: string) => `?${new URLSearchParams({ ...(sp.demo === "1" ? { demo: "1" } : {}), contesto: v })}`;
  return (
    <div className="grid grid-cols-2 rounded-xl bg-navy-50 p-1 text-sm font-semibold">
      <Link href={href("personale")} className={`rounded-lg px-3 py-2 text-center transition ${c.context === "personale" ? "bg-white text-navy-900 shadow-sm" : "text-mute"}`}>Personale</Link>
      <Link href={href("azienda")} className={`truncate rounded-lg px-3 py-2 text-center transition ${c.context === "azienda" ? "bg-white text-navy-900 shadow-sm" : "text-mute"}`}>{c.business.name}</Link>
    </div>
  );
}
