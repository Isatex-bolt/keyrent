/* Visual della Guida KeyRent: riproduzioni leggere delle schermate vere (stessi colori, card, KPI e calendario).
   Dati di esempio, nessuna chiamata al database. */

import { CategoryIcon } from "@/components/CategoryIcon";
import { Kpi, STATE } from "@/components/v2/ui";
import type { DayState } from "@/lib/v2/fleet";

const rise = (i: number) => ({ className: "animate-[kr-rise_.45s_ease-out_both]", style: { animationDelay: `${120 + i * 90}ms` } });

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-mute">{label}</p>
      <div className={`rounded-xl border border-line bg-white px-3 py-2.5 text-sm ${muted ? "text-mute" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function Photo({ cat, className = "" }: { cat: string; className?: string }) {
  return <div className={`grid place-items-center bg-gradient-to-br from-navy-50 to-navy-100 text-navy-700/40 ${className}`}><CategoryIcon slug={cat} className="h-10 w-10" /></div>;
}

/* ---------- Cliente ---------- */

export function VSearch() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-base font-bold text-navy-900">Noleggia ora</p>
      <div className="inline-flex rounded-full bg-navy-50 p-1 text-xs font-semibold">
        <span className="rounded-full bg-navy-900 px-3 py-1.5 text-white">Breve termine</span><span className="px-3 py-1.5 text-mute">Lungo termine</span>
      </div>
      <div {...rise(0)}><Field label="Dove" value="Padova" /></div>
      <div {...rise(1)} className={`${rise(1).className} grid grid-cols-2 gap-2`}><Field label="Ritiro" value="Sab 12 dic" /><Field label="Riconsegna" value="Dom 13 dic" /></div>
      <div {...rise(2)}><Field label="Cosa" value="Bici" /></div>
      <div {...rise(3)} className={`${rise(3).className} rounded-xl bg-teal-500 py-2.5 text-center text-sm font-semibold text-navy-950`}>Cerca</div>
    </div>
  );
}

export function VChoose() {
  const items = [
    { cat: "bici", t: "E-bike Trek Allant+", c: "Padova · 1,2 km", p: "da 35 €", n: "3 disponibili" },
    { cat: "auto", t: "Fiat 500 Hybrid", c: "Padova · 2,8 km", p: "da 45 €", n: "Disponibile" },
  ];
  return (
    <div className="grid gap-3">
      {items.map((x, i) => (
        <div key={x.t} {...rise(i)} className={`${rise(i).className} flex overflow-hidden rounded-2xl border border-line bg-white shadow-sm ${i === 0 ? "ring-2 ring-teal-500" : ""}`}>
          <Photo cat={x.cat} className="w-28 flex-none" />
          <div className="min-w-0 flex-1 p-3">
            <p className="truncate font-semibold">{x.t}</p>
            <p className="text-xs text-mute">{x.c}</p>
            <p className="mt-2 text-sm">{x.p.split(" ")[0]} <b className="text-base">{x.p.split(" ").slice(1).join(" ")}</b> <span className="text-xs text-mute">/ giorno</span></p>
            <p className="mt-1 inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-600">{x.n}</p>
          </div>
        </div>
      ))}
      <p {...rise(2)} className={`${rise(2).className} text-center text-xs text-mute`}>Prezzo totale per le tue date, foto, caratteristiche e condizioni</p>
    </div>
  );
}

export function VBook() {
  return (
    <div className="grid gap-3">
      <div {...rise(0)} className={`${rise(0).className} rounded-2xl border-2 border-navy-900 bg-white p-4`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Richiesta di prenotazione</p>
        <p className="mt-1 font-semibold">Scegli le date e invia la richiesta</p>
        <div className="mt-3 flex items-center gap-2 text-xs">
          {["Invii", "Il noleggiatore conferma", "Prenotato"].map((s, i) => (
            <span key={s} className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 font-medium ${i === 2 ? "bg-teal-500 text-navy-950" : "bg-navy-50 text-navy-900"}`}>{s}</span>{i < 2 && <span className="text-mute">→</span>}</span>
          ))}
        </div>
        <p className="mt-3 text-xs text-mute">Il noleggiatore risponde entro 24 ore.</p>
      </div>
    </div>
  );
}

export function VPay() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div {...rise(0)} className={`${rise(0).className} flex gap-3`}>
        <Photo cat="auto" className="h-12 w-12 flex-none rounded-xl" />
        <div><p className="font-semibold">Fiat 500 Hybrid</p><p className="text-xs text-mute">Sab 12 dic → Lun 14 dic</p></div>
      </div>
      <div {...rise(1)} className={`${rise(1).className} space-y-1.5 border-t border-line pt-3 text-sm`}>
        <div className="flex justify-between"><span className="text-mute">2 giorni × 45 €</span><span>90 €</span></div>
        <div className="flex items-baseline justify-between"><span className="font-semibold">Totale</span><span className="text-xl font-bold">90 €</span></div>
        <p className="text-[11px] text-mute">Cauzione gestita dal noleggiatore al ritiro, non inclusa.</p>
      </div>
      <div {...rise(2)} className={`${rise(2).className} rounded-xl border border-line px-3 py-2.5 text-sm`}>Carta di credito o debito · pagamento sicuro con Stripe</div>
      <p {...rise(3)} className={`${rise(3).className} rounded-xl bg-teal-50 p-3 text-xs text-navy-900`}>Alla richiesta blocchiamo l&apos;importo sulla carta. Lo addebitiamo solo quando il noleggiatore accetta. Se rifiuta, non paghi nulla.</p>
    </div>
  );
}

export function VProfile() {
  const tiles = [["Attivi", "1"], ["In attesa", "1"], ["Prossimi", "2"], ["Spesa del mese", "180 €"]];
  return (
    <div className="space-y-3">
      <p {...rise(0)} className={`${rise(0).className} text-lg font-bold`}>Ciao Giulia</p>
      <div {...rise(1)} className={`${rise(1).className} flex gap-3 rounded-2xl bg-navy-900 p-4 text-white`}>
        <Photo cat="auto" className="h-12 w-12 flex-none rounded-xl" />
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-teal-400">In corso</p><p className="font-semibold">Fiat 500 Hybrid</p><p className="text-xs text-white/70">Riconsegna oggi alle 18:00</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([l, v], i) => (
          <div key={l} {...rise(i + 2)} className={`${rise(i + 2).className} rounded-2xl border border-line bg-white p-3`}><p className="text-[11px] text-mute">{l}</p><p className="text-lg font-bold">{v}</p></div>
        ))}
      </div>
      <div {...rise(6)} className={`${rise(6).className} grid grid-cols-5 rounded-2xl border border-line bg-white py-2 text-center text-[10px] text-mute`}>
        {["Home", "Cerca", "Noleggi", "Messaggi", "Profilo"].map((t) => <span key={t} className={t === "Noleggi" ? "font-semibold text-navy-900" : ""}>{t}</span>)}
      </div>
    </div>
  );
}

export function VReady({ provider = false }: { provider?: boolean }) {
  return (
    <div className="grid place-items-center gap-4 py-6 text-center">
      <img src="/brand/keyrent-mark.svg" alt="" className="h-20 w-20 animate-[kr-rise_.5s_ease-out_both]" />
      <p {...rise(1)} className={`${rise(1).className} max-w-[16rem] text-sm text-mute`}>
        {provider ? "Auto, moto, bici, camper, barche, furgoni: una sola piattaforma." : "Auto, moto, bici, camper, barche e furgoni da noleggiatori professionali verificati."}
      </p>
    </div>
  );
}

/* ---------- Noleggiatore ---------- */

export function VBusiness() {
  return (
    <div className="space-y-3">
      <div {...rise(0)} className={`${rise(0).className} rounded-2xl border border-line bg-white p-4 shadow-sm`}>
        <div className="flex items-center justify-between"><p className="font-semibold">Noleggi Rossi S.r.l.</p><span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-600">Verificata</span></div>
        <p className="text-xs text-mute">P.IVA, sede legale, contatti</p>
      </div>
      <p {...rise(1)} className={`${rise(1).className} px-1 text-[10px] font-semibold uppercase tracking-wide text-mute`}>Le mie sedi</p>
      {[["Sede Padova", "Via Venezia 40, Padova"], ["Sede Jesolo", "Via Bafile 12, Jesolo"]].map(([n, a], i) => (
        <div key={n} {...rise(i + 2)} className={`${rise(i + 2).className} flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3`}>
          <span><span className="block text-sm font-semibold">{n}</span><span className="text-xs text-mute">{a}</span></span><span className="text-xs font-semibold text-teal-600">Modifica</span>
        </div>
      ))}
    </div>
  );
}

export function VDashboard() {
  return (
    <div className="grid grid-cols-2 gap-2 [&>div]:min-w-0">
      <div {...rise(0)}><Kpi label="Ricavi del mese (netto)" value="4.280 €" hint="4.505 € lordo" tone="good" /></div>
      <div {...rise(1)}><Kpi label="Noleggi attivi" value={6} /></div>
      <div {...rise(2)}><Kpi label="Disponibili oggi" value={14} hint="su 22 mezzi" /></div>
      <div {...rise(3)}><Kpi label="Richieste da approvare" value={2} hint="Rispondi entro 24 ore" tone="alert" /></div>
    </div>
  );
}

export function VWizard() {
  const steps = ["Categoria", "Marca e modello", "Foto", "Caratteristiche", "Prezzi", "Condizioni", "Sede e invio"];
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex gap-1">{steps.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i < 3 ? "bg-teal-500" : "bg-navy-100"}`} />)}</div>
      <p className="text-xs text-mute">Passo 3 di 7 · Foto</p>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <div key={i} {...rise(i)}><Photo cat="moto" className="aspect-square rounded-xl" /></div>)}
      </div>
      <div {...rise(3)} className={`${rise(3).className} grid grid-cols-2 gap-2`}><Field label="Prezzo al giorno" value="59 €" /><Field label="Cauzione" value="300 €" /></div>
      <div {...rise(4)} className={`${rise(4).className} rounded-xl bg-teal-500 py-2.5 text-center text-sm font-semibold text-navy-950`}>Continua</div>
    </div>
  );
}

const fleet = [
  { cat: "auto", t: "Fiat 500 Hybrid", s: "Padova", st: ["Pubblicato", "bg-teal-50 text-teal-600"], d: "free" as DayState },
  { cat: "furgoni", t: "Fiat Ducato 12 m³", s: "Padova", st: ["Pubblicato", "bg-teal-50 text-teal-600"], d: "booked" as DayState },
  { cat: "barche", t: "Gommone 40 CV", s: "Jesolo", st: ["In revisione", "bg-amber-50 text-amber-900"], d: "pending" as DayState },
  { cat: "bici", t: "E-bike Trek × 12", s: "Jesolo", st: ["Pubblicato", "bg-teal-50 text-teal-600"], d: "free" as DayState },
];

export function VFleet() {
  return (
    <div className="space-y-2">
      {fleet.map((v, i) => (
        <div key={v.t} {...rise(i)} className={`${rise(i).className} flex items-center gap-3 rounded-2xl border border-line bg-white p-2.5`}>
          <Photo cat={v.cat} className="h-11 w-11 flex-none rounded-xl" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{v.t}</p><p className="text-xs text-mute">{v.s}</p></div>
          <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${v.st[1]}`}>{v.st[0]}</span>
          <span title={STATE[v.d].label} className={`h-2.5 w-2.5 flex-none rounded-full ${STATE[v.d].dot}`} />
        </div>
      ))}
    </div>
  );
}

const CAL: DayState[][] = [
  ["free", "free", "booked", "booked", "booked", "free", "free", "free", "pending", "pending", "free", "free", "off", "off"],
  ["booked", "booked", "free", "free", "free", "free", "booked", "booked", "booked", "free", "free", "free", "free", "free"],
  ["free", "pending", "free", "off", "off", "free", "free", "free", "free", "booked", "booked", "free", "free", "free"],
];

export function VCalendar() {
  const keys: DayState[] = ["free", "booked", "pending", "off"];
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-3 shadow-sm">
      {CAL.map((row, r) => (
        <div key={r}>
          <p className="mb-1 text-xs font-semibold">{["Fiat 500 Hybrid", "Fiat Ducato 12 m³", "Gommone 40 CV"][r]}</p>
          <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]">
            {row.map((d, i) => (
              <span key={i} className={`aspect-square animate-[kr-fade_.3s_ease-out_both] rounded-[4px] ring-1 ring-inset ${STATE[d].cell}`} style={{ animationDelay: `${r * 80 + i * 25}ms` }} />
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-mute">
        {keys.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${STATE[k].dot}`} />{STATE[k].label}</span>)}
      </div>
    </div>
  );
}

export function VAllInOne() {
  return (
    <div className="relative h-64">
      <div {...rise(0)} className={`${rise(0).className} absolute left-0 top-0 w-[72%] rounded-2xl border border-line bg-white p-3 shadow-md`}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mute">Dashboard</p>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">{[["Ricavi", "4.280 €"], ["Attivi", "6"], ["Liberi", "14"], ["Richieste", "2"]].map(([l, v]) => <div key={l} className="rounded-lg bg-canvas p-1.5"><p className="text-mute">{l}</p><p className="font-bold">{v}</p></div>)}</div>
      </div>
      <div {...rise(1)} className={`${rise(1).className} absolute right-0 top-16 w-[62%] rounded-2xl border border-line bg-white p-3 shadow-md`}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mute">Calendario</p>
        <div className="grid grid-cols-7 gap-[3px]">{CAL[0].map((d, i) => <span key={i} className={`aspect-square rounded-[3px] ${STATE[d].cell}`} />)}</div>
      </div>
      <div {...rise(2)} className={`${rise(2).className} absolute bottom-0 left-6 w-[70%] rounded-2xl border border-line bg-white p-3 shadow-md`}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mute">I miei mezzi</p>
        {fleet.slice(0, 2).map((v) => <p key={v.t} className="flex items-center justify-between text-[11px]"><span>{v.t}</span><span className={`h-2 w-2 rounded-full ${STATE[v.d].dot}`} /></p>)}
      </div>
    </div>
  );
}

export function VNewRequest() {
  return (
    <div className="space-y-3">
      <div {...rise(0)} className={`${rise(0).className} rounded-2xl bg-navy-900 px-4 py-3 text-white shadow-lg`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-400">KeyRent · nuova richiesta</p>
        <p className="text-sm">Fiat 500 Hybrid · 12 → 14 dic · 135 €</p>
      </div>
      <div {...rise(1)} className={`${rise(1).className} rounded-2xl border border-line bg-white p-4`}>
        <div className="flex gap-3"><Photo cat="auto" className="h-12 w-12 flex-none rounded-xl" /><div><p className="font-semibold">Fiat 500 Hybrid</p><p className="text-xs text-mute">Sab 12 dic 10:00 → Lun 14 dic 10:00 · Sede Padova</p></div></div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm"><span className="text-mute">Netto per te</span><b>128 €</b></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
          <span className="rounded-xl border border-line py-2 text-center">Rifiuta</span><span className="rounded-xl bg-teal-500 py-2 text-center text-navy-950">Accetta</span>
        </div>
        <p className="mt-2 text-center text-[11px] text-amber-900">Rispondi entro 23 ore</p>
      </div>
    </div>
  );
}

export function VBookings() {
  const rows = [["Ritiro", "10:00", "Fiat 500 Hybrid", "Giulia B."], ["Riconsegna", "12:30", "Fiat Ducato 12 m³", "Marco T."], ["Ritiro", "17:00", "E-bike Trek", "Anna R."]];
  return (
    <div className="space-y-2">
      <p {...rise(0)} className={`${rise(0).className} px-1 text-[10px] font-semibold uppercase tracking-wide text-mute`}>Oggi</p>
      {rows.map(([k, h, v, c], i) => (
        <div key={h} {...rise(i + 1)} className={`${rise(i + 1).className} flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3`}>
          <span className="w-12 text-sm font-bold">{h}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{v}</span><span className="text-xs text-mute">{c}</span></span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${k === "Ritiro" ? "bg-teal-50 text-teal-600" : "bg-navy-50 text-navy-800"}`}>{k}</span>
        </div>
      ))}
    </div>
  );
}

export function VPayout() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-mute">Esempio di prenotazione</p>
      <div {...rise(0)} className={`${rise(0).className} flex justify-between text-sm`}><span className="text-mute">Totale prenotazione</span><span>500 €</span></div>
      <div {...rise(1)} className={`${rise(1).className} flex justify-between text-sm`}><span className="text-mute">Commissione KeyRent</span><span>− 25 €</span></div>
      <div {...rise(2)} className={`${rise(2).className} flex items-baseline justify-between border-t border-line pt-3`}><span className="font-semibold">Netto previsto</span><span className="text-2xl font-bold text-teal-600">475 €</span></div>
    </div>
  );
}
