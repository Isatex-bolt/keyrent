"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FleetBooking, FleetVehicle } from "@/lib/v2/fleet";
import { FleetTimeline } from "./FleetTimeline";
import { Legend, STATE, euroShort } from "./ui";

const LISTING: Record<string, { label: string; tone: string }> = {
  published: { label: "Pubblicato", tone: "bg-emerald-50 text-emerald-800" },
  draft: { label: "Bozza", tone: "bg-slate-100 text-slate-600" },
  pending_review: { label: "In approvazione", tone: "bg-amber-50 text-amber-800" },
  changes_required: { label: "Modifiche richieste", tone: "bg-amber-50 text-amber-800" },
  approved: { label: "Approvato", tone: "bg-emerald-50 text-emerald-800" },
  suspended: { label: "Sospeso", tone: "bg-slate-100 text-slate-600" },
  unpublished: { label: "Non pubblicato", tone: "bg-slate-100 text-slate-600" },
  rejected: { label: "Rifiutato", tone: "bg-red-50 text-red-700" },
};

type View = "card" | "tabella" | "calendario";

export function FleetCatalog({ vehicles, days, bookings, today, locations, vehicleBase, qs, addHref }: {
  vehicles: FleetVehicle[]; days: string[]; bookings: FleetBooking[]; today: string;
  locations: { id: string; name: string }[]; vehicleBase: string; qs: string; addHref: string;
}) {
  const vehicleHref = (id: string, extra = "") => `${vehicleBase}/${id}${qs}${qs && extra.startsWith("?") ? `&${extra.slice(1)}` : extra}`;
  const [view, setView] = useState<View>("card");
  const [q, setQ] = useState(""); const [sede, setSede] = useState(""); const [stato, setStato] = useState("");
  const [disp, setDisp] = useState(""); const [cat, setCat] = useState("");
  const [dal, setDal] = useState(""); const [al, setAl] = useState("");
  // libero in tutte le date scelte (giorni fuori dall'intervallo caricato: non si escludono)
  const freeIn = (v: FleetVehicle) => {
    if (!dal) return true;
    const end = al && al >= dal ? al : dal;
    return Object.entries(v.days).every(([d, c]) => d < dal || d > end || c.state === "free" || c.state === "partial");
  };
  const cats = useMemo(() => [...new Map(vehicles.map((v) => [v.categorySlug, v.category])).entries()], [vehicles]);
  const list = vehicles.filter((v) => {
    const t = v.days[today]?.state;
    return (!q || `${v.title} ${v.make} ${v.model}`.toLowerCase().includes(q.toLowerCase()))
      && (!sede || v.locationId === sede) && (!stato || v.status === stato) && (!cat || v.categorySlug === cat)
      && freeIn(v) && (!disp || (disp === "libero" ? t === "free" || t === "partial" : disp === "occupato" ? t === "booked" || t === "pending" : t === "off"));
  });
  const sel = "h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15";
  const active = !!(q || sede || stato || disp || cat || dal);
  const reset = () => { setQ(""); setSede(""); setStato(""); setDisp(""); setCat(""); setDal(""); setAl(""); };
  const fmt = (d: string) => d.split("-").reverse().join("/");
  const dateCls = "min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-calendar-picker-indicator]:opacity-50";
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome, marca o modello" className={`${sel} sm:flex-1`} />
          <div className="flex shrink-0 rounded-xl bg-navy-50 p-1">
            {(["card", "tabella", "calendario"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${view === v ? "bg-white text-navy-900 shadow-sm" : "text-mute hover:text-navy-900"}`}>
                {v === "card" ? "Schede" : v === "tabella" ? "Lista" : "Calendario"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
          <select value={sede} onChange={(e) => setSede(e.target.value)} className={sel} aria-label="Sede"><option value="">Tutte le sedi</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={sel} aria-label="Categoria"><option value="">Tutte le categorie</option>{cats.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select>
          <select value={stato} onChange={(e) => setStato(e.target.value)} className={sel} aria-label="Stato annuncio"><option value="">Tutti gli stati</option>{Object.entries(LISTING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select value={disp} onChange={(e) => setDisp(e.target.value)} className={sel} aria-label="Disponibilità oggi"><option value="">Disponibilità oggi</option><option value="libero">Libero oggi</option><option value="occupato">Occupato oggi</option><option value="fermo">Non disponibile</option></select>
          <div className={`${sel} flex items-center gap-2`}>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-mute">Libero dal</span>
            <input type="date" aria-label="Dal" value={dal} min={today} style={{ minHeight: 0 }} className={dateCls}
              onChange={(e) => { setDal(e.target.value); if (!al || al < e.target.value) setAl(e.target.value); }} />
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-mute">al</span>
            <input type="date" aria-label="Al" value={al} min={dal || today} style={{ minHeight: 0 }} className={dateCls} onChange={(e) => setAl(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-mute">
        <span>
          <b className="text-navy-900">{list.length}</b> {list.length === 1 ? "mezzo" : "mezzi"}
          {dal ? ` liberi ${al && al !== dal ? `dal ${fmt(dal)} al ${fmt(al)}` : `il ${fmt(dal)}`}` : ""}
          {active && <button onClick={reset} className="ml-3 font-semibold text-teal-600 hover:underline">Azzera filtri</button>}
        </span>
        {addHref && <Link href={addHref} className="btn-primary px-4 py-2 text-sm">Aggiungi mezzo</Link>}
      </div>

      <div key={view} className="animate-[riseIn_.25s_ease-out]">
        {view === "calendario" ? (
          <div className="space-y-3"><Legend pool={list.some((v) => v.quantityMode === "pool")} /><FleetTimeline vehicles={list} days={days} bookings={bookings} today={today} vehicleBase={vehicleBase} qs={qs} /></div>
        ) : view === "tabella" ? (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-mute"><tr className="border-b border-line">
                {["Mezzo", "Categoria", "Sede", "Annuncio", "Oggi", "Da", "Prenotazioni", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {list.map((v) => { const t = v.days[today]?.state ?? "off"; const l = LISTING[v.status] ?? { label: v.status, tone: "bg-slate-100" }; return (
                  <tr key={v.id} className="border-b border-line last:border-0 hover:bg-navy-50/50">
                    <td className="px-4 py-3"><Link href={vehicleHref(v.id)} className="font-semibold hover:text-teal-600">{v.title}</Link><div className="text-xs text-mute">{[v.make, v.model].filter(Boolean).join(" ")}</div></td>
                    <td className="px-4 py-3">{v.category}</td><td className="px-4 py-3">{v.locationName}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.tone}`}>{l.label}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${STATE[t].dot}`} />{STATE[t].label}</span></td>
                    <td className="px-4 py-3">{v.priceFromCents ? euroShort(v.priceFromCents) : "—"}</td>
                    <td className="px-4 py-3">{v.upcoming}</td>
                    <td className="px-4 py-3 text-right"><Link href={vehicleHref(v.id)} className="text-teal-600 hover:underline">Apri</Link></td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((v) => { const t = v.days[today]?.state ?? "off"; const l = LISTING[v.status] ?? { label: v.status, tone: "bg-slate-100" }; return (
              <article key={v.id} className="group overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
                <Link href={vehicleHref(v.id)} className="relative block aspect-[16/9] bg-gradient-to-br from-navy-50 to-teal-50">
                  {v.cover ? <img src={v.cover} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs font-semibold uppercase tracking-[0.2em] text-navy-700/50">{v.category} · foto da caricare</span>}
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${l.tone}`}>{l.label}</span>
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-sm">
                    {dal ? <><span className="h-2 w-2 rounded-full bg-emerald-500" />Libero nelle date</> : <><span className={`h-2 w-2 rounded-full ${STATE[t].dot}`} />{v.quantityMode === "pool" ? `${v.days[today]?.free ?? 0}/${v.units} liberi` : STATE[t].label}</>}
                  </span>
                </Link>
                <div className="space-y-2 p-4">
                  <div>
                    <Link href={vehicleHref(v.id)} className="font-semibold text-navy-900 hover:text-teal-600">{v.title}</Link>
                    <p className="text-xs text-mute">{v.category} · {[v.make, v.model].filter(Boolean).join(" ") || "—"} · {v.locationName}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{v.priceFromCents ? <>da <b>{euroShort(v.priceFromCents)}</b></> : <span className="text-mute">Prezzo da impostare</span>}</span>
                    <span className="text-xs text-mute">{v.upcoming} prenotazioni</span>
                  </div>
                  {v.alerts.length > 0 && <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{v.alerts.join(" · ")}</p>}
                  <div className="grid grid-cols-4 gap-1 pt-1 text-center text-xs font-medium">
                    {[["Visualizza", ""], ["Modifica", "?modifica=1"], ["Disponibilità", "#calendario"], ["Prenotazioni", "#prenotazioni"]].map(([a, h]) => (
                      <Link key={a} href={vehicleHref(v.id, h)} className="rounded-lg px-1 py-2 text-navy-800 hover:bg-navy-50">{a}</Link>
                    ))}
                  </div>
                </div>
              </article>); })}
            {!list.length && <p className="col-span-full rounded-2xl border border-dashed border-line p-8 text-center text-sm text-mute">Nessun mezzo con questi filtri.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
