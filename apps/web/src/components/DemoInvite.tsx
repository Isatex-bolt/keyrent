"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { enterDemo } from "@/app/accedi/actions";
import { SubmitOnce } from "./SubmitOnce";

const KEY = "kr_demo_invite"; // ora di arrivo dal link demo (sessionStorage: vale finché la scheda è aperta)
const CLOSED = "kr_demo_invite_closed";
const DELAY = 30_000;

/**
 * Chi arriva dal link della demo (/demo → /?demo=invito) prima gira il sito come un cliente;
 * dopo 30 secondi compare l'invito "Guarda come sarebbe la tua area riservata" che lo fa entrare nella demo.
 * Se lo chiude resta un pulsante in basso per entrare quando vuole.
 */
export function DemoInvite() {
  const path = usePathname();
  const [state, setState] = useState<"off" | "open" | "pill">("off");

  useEffect(() => {
    let start: number | null = null;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("demo") === "invito") {
        if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, String(new Date().getTime()));
        url.searchParams.delete("demo");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      const v = sessionStorage.getItem(KEY);
      start = v ? Number(v) : null;
    } catch { return; }
    if (!start) return;
    const closed = (() => { try { return !!sessionStorage.getItem(CLOSED); } catch { return false; } })();
    const left = closed ? 0 : Math.max(0, start + DELAY - new Date().getTime());
    const t = setTimeout(() => setState(closed ? "pill" : "open"), left);
    return () => clearTimeout(t);
  }, []);

  if (state === "off" || /^\/(pro|demo|accedi|registrati|admin)/.test(path)) return null;

  const done = () => { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(CLOSED); } catch {} };

  if (state === "pill") {
    return (
      <form action={enterDemo} onSubmit={done} className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 lg:bottom-6">
        <SubmitOnce className="whitespace-nowrap rounded-full bg-navy-950 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-2 ring-teal-400" pendingText="Preparo la tua area…">
          Prova la tua area noleggiatore →
        </SubmitOnce>
      </form>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="demo-invite-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-[kr-rise_.25s_ease-out_both] rounded-3xl bg-navy-950 p-6 text-white shadow-2xl ring-1 ring-white/10 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Per noleggiatori</p>
        <h2 id="demo-invite-title" className="mt-2 text-2xl font-bold leading-tight">Guarda come sarebbe la tua area riservata</h2>
        <p className="mt-3 text-white/75">
          Hai visto il sito come lo vedono i clienti. Ora entra nell&apos;area di un noleggio di esempio: mezzi, richieste, calendario e incassi.
          Nessuna registrazione, è tutta tua e si cancella da sola dopo 24 ore.
        </p>
        <form action={enterDemo} onSubmit={done} className="mt-6">
          <SubmitOnce className="w-full rounded-2xl bg-teal-400 px-6 py-4 text-lg font-semibold text-navy-950 hover:bg-teal-300" pendingText="Preparo la tua area…">
            Entra nella tua area
          </SubmitOnce>
        </form>
        <button type="button" onClick={() => { try { sessionStorage.setItem(CLOSED, "1"); } catch {} setState("pill"); }}
          className="mt-3 w-full rounded-2xl px-6 py-3 text-sm font-semibold text-white/70 hover:text-white">
          Continua a guardare il sito
        </button>
      </div>
    </div>
  );
}
