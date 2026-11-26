import Link from "next/link";
import type { CustomerData, Rental } from "@/lib/v2/customer";
import { setBookingContext } from "@/app/account/contextActions";

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
  verifying: { label: "Pagamento in verifica", tone: "bg-amber-50 text-amber-800" },
  confirmed: { label: "Confermata · da ritirare", tone: "bg-emerald-50 text-emerald-800" },
  picked_up: { label: "In corso", tone: "bg-navy-900 text-white" },
  completed: { label: "Conclusa", tone: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancellata", tone: "bg-red-50 text-red-700" },
  declined: { label: "Non disponibile", tone: "bg-red-50 text-red-700" },
  expired: { label: "Scaduta", tone: "bg-slate-100 text-slate-600" },
};

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

/** Interruttore Privato / Azienda: decide per chi prenoti e quali noleggi vedi. Solo se l'account ha entrambi i profili. */
export function ContextSwitch({ c, back }: { c: CustomerData; back: string }) {
  if (!c.orgs.length || !c.privato) return null;
  const me = [c.first, c.last].filter(Boolean).join(" ");
  const opts = [{ id: "", title: "Privato", sub: me }, ...c.orgs.map((o) => ({ id: o.id, title: "Azienda", sub: o.name }))];
  return (
    <form action={setBookingContext} className={`grid gap-1 rounded-2xl bg-navy-50 p-1 ${opts.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
      <input type="hidden" name="back" value={back} />
      {opts.map((o) => {
        const on = (c.businessId ?? "") === o.id;
        return (
          <button key={o.id || "p"} name="ctx" value={o.id} aria-pressed={on}
            className={`min-h-12 rounded-xl px-3 py-2 text-center transition ${on ? "bg-white shadow-sm" : ""}`}>
            <span className={`block text-sm font-semibold ${on ? "text-navy-900" : "text-mute"}`}>{o.title}</span>
            {o.sub && <span className="block truncate text-xs text-mute">{o.sub}</span>}
          </button>
        );
      })}
    </form>
  );
}
