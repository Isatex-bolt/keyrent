"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Barra in basso per telefono: 5 voci, tocchi grandi, sopra la barra di sistema dell'iPhone. */
const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  cerca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  noleggi: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  messaggi: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  profilo: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};
const ITEMS: { k: keyof typeof I; label: string; href: string }[] = [
  { k: "home", label: "Home", href: "/preview/customer-home" },
  { k: "cerca", label: "Cerca", href: "/preview/customer-search" },
  { k: "noleggi", label: "Noleggi", href: "/preview/customer-rentals" },
  { k: "messaggi", label: "Messaggi", href: "/preview/customer-messages" },
  { k: "profilo", label: "Profilo", href: "/preview/customer-profile" },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["demo", "contesto"]) { const v = sp.get(k); if (v) keep.set(k, v); }
  const qs = keep.toString() ? `?${keep}` : "";
  return (
    <nav aria-label="Navigazione"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map((it) => {
          const on = path === it.href || path.startsWith(`${it.href}/`) || (it.k === "noleggi" && path.startsWith("/preview/customer-dashboard"));
          return (
            <li key={it.k}>
              <Link href={`${it.href}${qs}`} className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95 ${on ? "text-navy-900" : "text-mute"}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">{I[it.k]}</svg>
                {it.label}
                {it.k === "messaggi" && unread > 0 && <span className="absolute right-[26%] top-2 grid h-4 min-w-4 place-items-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
                {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-500" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Su computer le stesse sezioni stanno in alto, come schede. */
export function TopTabs() {
  const path = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["demo", "contesto"]) { const v = sp.get(k); if (v) keep.set(k, v); }
  const qs = keep.toString() ? `?${keep}` : "";
  return (
    <div className="hidden gap-1 rounded-xl bg-white p-1 ring-1 ring-line lg:inline-flex">
      {ITEMS.map((it) => {
        const on = path === it.href || path.startsWith(`${it.href}/`);
        return <Link key={it.k} href={`${it.href}${qs}`} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${on ? "bg-navy-900 text-white" : "text-mute hover:text-navy-900"}`}>{it.label}</Link>;
      })}
    </div>
  );
}
