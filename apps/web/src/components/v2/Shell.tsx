"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const NAV: { section: string; items: { label: string; href: string; soon?: boolean; current?: boolean }[] }[] = [
  { section: "Operatività", items: [
    { label: "Dashboard", href: "/preview/provider-dashboard-v2" },
    { label: "Calendario", href: "/preview/provider-calendar-v2" },
    { label: "Richieste", href: "/pro/richieste", current: true },
    { label: "Prenotazioni", href: "/pro/prenotazioni", current: true },
    { label: "Messaggi", href: "/pro/messaggi", current: true },
  ] },
  { section: "Flotta", items: [
    { label: "I miei mezzi", href: "/preview/provider-fleet-v2" },
    { label: "Le mie sedi", href: "/pro/sedi", current: true },
  ] },
  { section: "Attività", items: [
    { label: "La mia attività", href: "/pro/attivita", current: true },
    { label: "Pagamenti e incassi", href: "#", soon: true },
    { label: "Statistiche", href: "#", soon: true },
    { label: "Team", href: "#", soon: true },
    { label: "Impostazioni", href: "#", soon: true },
  ] },
];

/** Struttura dell'area noleggiatore V2: menu laterale (cassetto su telefono) + filtro sede. */
export function ProviderShellV2({ orgName, locations, sede, children }: {
  orgName: string; locations: { id: string; name: string }[]; sede: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const qs = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(extra)) if (v === null) p.delete(k); else p.set(k, v);
    const s = p.toString(); return s ? `?${s}` : "";
  };
  const keepQs = qs({ mese: null, mezzo: null });
  const nav = (
    <nav className="space-y-6">
      <div className="px-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">Area noleggiatore</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-navy-900">{orgName}</p>
      </div>
      {NAV.map((g) => (
        <div key={g.section} className="space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute/80">{g.section}</p>
          {g.items.map((n) => {
            const on = path === n.href;
            if (n.soon) return (
              <span key={n.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-mute/60">
                {n.label}<span className="text-[11px]">In arrivo</span>
              </span>
            );
            return (
              <Link key={n.label} href={n.current ? n.href : `${n.href}${keepQs}`} onClick={() => setOpen(false)}
                className={`relative block rounded-lg px-3 py-2 text-sm transition ${on ? "bg-white font-semibold text-navy-900 shadow-sm ring-1 ring-line before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-teal-500" : "text-ink/80 hover:bg-white hover:text-navy-900"}`}>
                {n.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn-ghost px-3" aria-label="Apri menu">Menu</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Chiudi" onClick={() => setOpen(false)} className="absolute inset-0 bg-navy-950/30 animate-[fadeIn_.15s]" />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-canvas p-4 shadow-2xl animate-[riseIn_.2s_ease-out]">{nav}</div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-24">{nav}</div></aside>
        <div className="min-w-0 space-y-6">
          {locations.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {[{ id: "tutte", name: "Tutte le sedi" }, ...locations].map((l) => (
                <button key={l.id} onClick={() => router.push(`${path}${qs({ sede: l.id === "tutte" ? null : l.id })}`, { scroll: false })}
                  className={`chip ${sede === l.id ? "chip-on" : ""}`}>{l.name}</button>
              ))}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
