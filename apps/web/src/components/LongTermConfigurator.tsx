"use client";

import { useState } from "react";
import Link from "next/link";
import { LT_DURATIONS, LT_SERVICES, kmFor, monthlyRate } from "@/lib/longTerm";
import type { Offer } from "@/lib/data";

const eur = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

/** Lungo termine nella scheda: il cliente sceglie durata, km all'anno e servizi; la rata mensile si aggiorna subito. */
export function LongTermConfigurator({ listingId, title, offer, initialMonths }: { listingId: string; title: string; offer: Offer; initialMonths?: number }) {
  const baseKm = offer.lt_km_per_year;
  const durations = LT_DURATIONS.filter((m) => kmFor(offer.lt_prices, m, baseKm).length > 0);
  const [months, setMonths] = useState<number>(durations.includes(initialMonths as never) ? initialMonths! : durations[durations.length - 1] ?? 36);
  const kms = kmFor(offer.lt_prices, months, baseKm);
  const [kmWanted, setKm] = useState<number>(kms[0] ?? baseKm ?? 0);
  // cambiando durata, se quella fascia di km non c'è si prende la più vicina
  const km = kms.includes(kmWanted) ? kmWanted : kms.reduce((best, k) => Math.abs(k - kmWanted) < Math.abs(best - kmWanted) ? k : best, kms[0] ?? 0);
  const services = LT_SERVICES.filter((s) => offer.lt_services?.[s.key]?.offered);
  const included = services.filter((s) => !offer.lt_services[s.key].cents).map((s) => s.key);
  const [chosen, setChosen] = useState<string[]>(included);
  const rate = monthlyRate(offer.lt_prices, offer.lt_services, months, chosen, km, baseKm);
  const summary = `Richiesta noleggio a lungo termine: ${title}, ${months} mesi, ${km.toLocaleString("it-IT")} km all'anno, servizi: ${chosen.map((k) => LT_SERVICES.find((s) => s.key === k)?.label).join(", ") || "nessuno"}. Rata indicata: ${eur(rate)}/mese.`;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Lungo termine</p>
        <p className="mt-1 text-sm text-mute">Scegli durata, km all&apos;anno e servizi: la rata si aggiorna subito.</p>
      </div>
      <div>
        <p className="label">Durata</p>
        <div className="grid grid-cols-4 gap-2">
          {durations.map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} aria-pressed={months === m}
              className={`min-h-12 rounded-xl border text-sm font-semibold ${months === m ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{m} mesi</button>
          ))}
        </div>
      </div>
      {kms.length > 0 && (
        <div>
          <p className="label">Km all&apos;anno</p>
          <div className={`grid gap-2 ${kms.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {kms.map((k) => (
              <button key={k} type="button" onClick={() => setKm(k)} aria-pressed={km === k}
                className={`min-h-12 rounded-xl border text-sm font-semibold ${km === k ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{k.toLocaleString("it-IT")}</button>
            ))}
          </div>
        </div>
      )}
      {services.length > 0 && (
        <div>
          <p className="label">Servizi</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {services.map((s) => {
              const cents = offer.lt_services[s.key].cents;
              const on = chosen.includes(s.key);
              return (
                <li key={s.key}>
                  <label className={`flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 ${cents ? "cursor-pointer" : ""}`}>
                    <span className="flex items-center gap-3">
                      <input type="checkbox" checked={on} disabled={!cents} onChange={(e) => setChosen((c) => e.target.checked ? [...c, s.key] : c.filter((k) => k !== s.key))} className="h-5 w-5 accent-teal-600" />
                      <span className="text-[15px]">{s.label}</span>
                    </span>
                    <span className="text-sm text-mute">{cents ? `+ ${eur(cents)}/mese` : "Incluso"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="rounded-2xl bg-navy-900 p-4 text-white">
        <p className="text-sm text-white/70">Rata mensile · {months} mesi · {km.toLocaleString("it-IT")} km/anno</p>
        <p className="text-3xl font-bold tracking-tight">{eur(rate)}<span className="text-base font-medium text-white/70"> /mese</span></p>
        <p className="mt-1 text-xs text-white/70">IVA inclusa{offer.lt_extra_km_cents ? ` · km oltre la fascia ${eur(offer.lt_extra_km_cents)}/km` : ""}</p>
      </div>
      <Link href={`/messaggi/nuovo?annuncio=${listingId}&testo=${encodeURIComponent(summary)}`} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-500 px-4 font-semibold text-navy-950">
        Richiedi questo noleggio
      </Link>
      <p className="text-center text-xs text-mute">Il noleggiatore ti risponde con la proposta e i documenti necessari. Nessun pagamento ora.</p>
    </div>
  );
}
