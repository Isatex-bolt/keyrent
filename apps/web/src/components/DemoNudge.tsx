"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const START = "kr-demo-start";
const DONE = "kr-demo-nudged";
const AFTER_MS = 5 * 60_000;

/**
 * Account di prova: dopo 5 minuti di uso (una volta per sessione) o quando si prova a salvare i dati dell'attività,
 * invito a registrarsi davvero. "Continua a provare" chiude e lascia proseguire la demo.
 */
export function DemoNudge({ register }: { register: () => Promise<void> }) {
  const sp = useSearchParams();
  const blocked = sp.get("demo") === "nonsalvato";
  const [open, setOpen] = useState<"" | "time" | "save">("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- apertura dovuta al ritorno da un salvataggio bloccato
      if (blocked) { setOpen("save"); return; }
      if (sessionStorage.getItem(DONE)) return;
      const start = Number(sessionStorage.getItem(START)) || Date.now();
      sessionStorage.setItem(START, String(start));
      timer = setTimeout(() => { sessionStorage.setItem(DONE, "1"); setOpen("time"); }, Math.max(0, start + AFTER_MS - Date.now()));
    } catch { /* storage non disponibile: nessun promemoria */ }
    return () => clearTimeout(timer);
  }, [blocked]);

  if (!open) return null;
  const save = open === "save";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center">
      <button type="button" aria-label="Chiudi" onClick={() => setOpen("")} className="absolute inset-0 bg-navy-950/60" />
      <div role="dialog" aria-modal="true" className="relative w-full animate-[kr-up_.25s_ease-out] rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">{save ? "Questa è una demo" : "Ti piace KeyRent?"}</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight">
          {save ? "Qui i dati della tua attività non vengono salvati." : "Sei pronto? Registra davvero la tua attività e inizia a guadagnare."}
        </h2>
        <p className="mt-3 text-mute">
          {save
            ? "L'account di prova serve a provare annunci, richieste e calendario. Per inserire la tua attività vera registrati: bastano 2 minuti."
            : "Crea il tuo account noleggiatore: inserisci i dati dell'attività, le sedi e il primo mezzo. Il team KeyRent verifica e ti mette online."}
        </p>
        <form action={register} className="mt-6">
          <button className="w-full rounded-2xl bg-teal-500 px-6 py-4 text-lg font-semibold text-navy-950 hover:bg-teal-400">Registra la mia attività</button>
        </form>
        <button type="button" onClick={() => setOpen("")} className="mt-2 w-full rounded-2xl px-6 py-3 font-semibold text-mute hover:bg-navy-50">
          Continua a provare la demo
        </button>
      </div>
    </div>
  );
}
