"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveCount } from "@/components/LiveCount";

/** Barra in basso per telefono (cliente): 5 voci, tocchi grandi, sopra la barra di sistema dell'iPhone. */
const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  cerca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  noleggi: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  messaggi: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  profilo: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};
const ITEMS: { k: keyof typeof I; label: string; href: string; match: string[] }[] = [
  { k: "home", label: "Home", href: "/", match: ["/"] },
  { k: "cerca", label: "Cerca", href: "/cerca/rapida", match: ["/cerca", "/mezzo", "/destinazioni", "/prenota"] },
  { k: "noleggi", label: "Noleggi", href: "/account/noleggi", match: ["/account/noleggi", "/account/prenotazioni", "/account"] },
  { k: "messaggi", label: "Messaggi", href: "/messaggi", match: ["/messaggi"] },
  { k: "profilo", label: "Profilo", href: "/account/profilo", match: ["/account/profilo", "/account/dati", "/account/azienda", "/account/password", "/assistenza"] },
];
const HIDDEN = ["/pro", "/admin", "/accedi", "/registrati", "/auth", "/password-dimenticata", "/esci", "/mezzo", "/prenota"];

export function BottomNav() {
  const path = usePathname();
  if (HIDDEN.some((h) => path === h || path.startsWith(`${h}/`))) return null;
  // la voce più specifica che corrisponde
  const best = ITEMS.flatMap((it) => it.match.filter((m) => m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`)).map((m) => ({ k: it.k, len: m.length })))
    .sort((a, b) => b.len - a.len)[0]?.k;
  return (
    <>
      <div className="h-[calc(64px+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />
      <nav aria-label="Navigazione" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {ITEMS.map((it) => {
            const on = best === it.k;
            return (
              <li key={it.k}>
                <Link href={it.href} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95 ${on ? "text-navy-900" : "text-mute"}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">{I[it.k]}</svg>
                  {it.label}
                  {it.k === "messaggi" && <span className="absolute right-[18%] top-1"><LiveCount keys={["messages"]} initial={0} /></span>}
                  {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-500" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
