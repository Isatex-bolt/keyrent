"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Badges } from "@/lib/badges";
import { LiveCount } from "./LiveCount";

type Item = { label: string; href?: string; badge?: keyof Badges; exact?: boolean };
const NAV: { section: string; items: Item[] }[] = [
  { section: "Account", items: [
    { label: "Il mio profilo", href: "/pro/profilo" },
  ] },
  { section: "Operatività", items: [
    { label: "Dashboard", href: "/pro", exact: true },
    { label: "Calendario", href: "/pro/calendario" },
    { label: "Richieste", href: "/pro/richieste", badge: "requests" },
    { label: "Prenotazioni", href: "/pro/prenotazioni", badge: "provider_bookings" },
    { label: "Messaggi", href: "/pro/messaggi", badge: "messages" },
  ] },
  { section: "Flotta", items: [
    { label: "I miei mezzi", href: "/pro/mezzi", badge: "listings_to_fix" },
    { label: "Le mie sedi", href: "/pro/sedi" },
  ] },
  { section: "Attività", items: [
    { label: "La mia attività", href: "/pro/attivita" },
    { label: "Assistenza KeyRent", href: "/pro/assistenza", badge: "support" },
    { label: "Guida KeyRent", href: "/guida/noleggiatori" },
    { label: "Pagamenti e incassi" }, { label: "Statistiche" }, { label: "Team" },
  ] },
];

/** Menu dell'area noleggiatore: a sezioni, laterale su computer, a cassetto su telefono. */
export function ProNav({ badges }: { badges?: Partial<Badges> }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const nav = (
    <nav className="space-y-6">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-600">Area noleggiatore</p>
      {NAV.map((g) => (
        <div key={g.section} className="space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute/80">{g.section}</p>
          {g.items.map((n) => {
            if (!n.href) return (
              <span key={n.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-mute/60">{n.label}<span className="text-[11px]">In arrivo</span></span>
            );
            const on = n.exact ? path === n.href : path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link key={n.label} href={n.href} onClick={() => setOpen(false)}
                className={`relative flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${on ? "bg-white font-semibold text-navy-900 shadow-sm ring-1 ring-line before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-teal-500" : "text-ink/80 hover:bg-white hover:text-navy-900"}`}>
                <span>{n.label}</span>
                {n.badge && <LiveCount keys={[n.badge]} initial={badges?.[n.badge] ?? 0} />}
              </Link>
            );
          })}
        </div>
      ))}
      <form action="/esci" method="post" className="px-1">
        <button className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50">Esci</button>
      </form>
    </nav>
  );
  return (
    <>
      <div className="lg:hidden">
        <button onClick={() => setOpen(true)} className="btn-ghost px-3" aria-label="Apri menu">Menu area noleggiatore</button>
        {open && (
          <div className="fixed inset-0 z-50">
            <button aria-label="Chiudi" onClick={() => setOpen(false)} className="absolute inset-0 bg-navy-950/30 animate-[fadeIn_.15s]" />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-canvas p-4 shadow-2xl animate-[riseIn_.2s_ease-out]">{nav}</div>
          </div>
        )}
      </div>
      <aside className="hidden lg:block"><div className="sticky top-24">{nav}</div></aside>
    </>
  );
}
