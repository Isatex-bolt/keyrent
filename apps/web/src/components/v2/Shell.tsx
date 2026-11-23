"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const NAV: { label: string; href: string; icon: string; soon?: boolean; current?: boolean }[] = [
  { label: "Dashboard", href: "/preview/provider-dashboard-v2", icon: "◧" },
  { label: "I miei mezzi", href: "/preview/provider-fleet-v2", icon: "🚗" },
  { label: "Calendario", href: "/preview/provider-calendar-v2", icon: "📅" },
  { label: "Richieste", href: "/pro/richieste", icon: "📥", current: true },
  { label: "Prenotazioni", href: "/pro/prenotazioni", icon: "🗓️", current: true },
  { label: "Messaggi", href: "/pro/messaggi", icon: "💬", current: true },
  { label: "La mia attività", href: "/pro/attivita", icon: "🏢", current: true },
  { label: "Le mie sedi", href: "/pro/sedi", icon: "📍", current: true },
  { label: "Pagamenti e incassi", href: "#", icon: "💶", soon: true },
  { label: "Statistiche", href: "#", icon: "📈", soon: true },
  { label: "Team", href: "#", icon: "👥", soon: true },
  { label: "Impostazioni", href: "#", icon: "⚙️", soon: true },
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
    <nav className="space-y-0.5">
      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-600">{orgName}</p>
      {NAV.map((n) => {
        const on = path === n.href;
        if (n.soon) return (
          <span key={n.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-mute/70">
            <span className="w-5 text-center">{n.icon}</span>{n.label}<span className="ml-auto rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase">presto</span>
          </span>
        );
        return (
          <Link key={n.label} href={n.current ? n.href : `${n.href}${keepQs}`} onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-navy-900 text-white" : "text-ink hover:bg-white"}`}>
            <span className="w-5 text-center">{n.icon}</span>{n.label}
            {n.current && <span className="ml-auto text-[10px] text-mute">attuale</span>}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn-ghost px-3" aria-label="Apri menu">☰ Menu</button>
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
