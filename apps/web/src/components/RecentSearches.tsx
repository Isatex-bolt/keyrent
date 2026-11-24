"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* "Continua la ricerca" (stile Booking): le ultime ricerche restano solo in questo browser. */
type Recent = { url: string; title: string; sub: string };
const KEY = "kr-recent-searches";

function read(): Recent[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Recent[]; } catch { return []; }
}

/** Da mettere nella pagina risultati: salva la ricerca appena fatta. */
export function SaveSearch({ title, sub }: { title: string; sub: string }) {
  useEffect(() => {
    const url = window.location.pathname + window.location.search;
    if (!window.location.search) return;
    const list = [{ url, title, sub }, ...read().filter((r) => r.url !== url && r.title + r.sub !== title + sub)].slice(0, 4);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* niente */ }
  }, [title, sub]);
  return null;
}

/** Home: riga "Continua la ricerca", solo se ci sono ricerche recenti. */
export function RecentSearches() {
  const [list, setList] = useState<Recent[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- dati salvati nel browser, letti dopo il montaggio
  useEffect(() => { setList(read()); }, []);
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Continua la ricerca</h2>
      <div className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {list.map((r) => (
          <Link key={r.url} href={r.url} className="w-[78%] flex-none rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-navy-900/30 sm:w-[40%] lg:w-[24%]">
            <p className="truncate font-semibold">{r.title}</p>
            <p className="mt-1 truncate text-sm text-mute">{r.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
