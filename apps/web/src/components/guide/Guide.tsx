"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { track } from "@/lib/analytics";
import * as V from "./visuals";

export type Viewer = { loggedIn: boolean; provider: boolean };
type Cta = { label: string; href: string; ghost?: boolean };
type Slide = { title: string; text: string; visual: ReactNode; strong?: string; ctas?: Cta[] };

function customerSlides(v: Viewer): Slide[] {
  return [
    { title: "Trova il mezzo che ti serve", text: "Scegli dove, quando e cosa vuoi noleggiare. KeyRent ti mostra i mezzi disponibili per le tue date.", visual: <V.VSearch /> },
    { title: "Scegli il mezzo", text: "Confronta caratteristiche, prezzo, disponibilità e condizioni, e scegli quello più adatto a te.", visual: <V.VChoose /> },
    // ⚡ prenotazione immediata: da aggiornare quando sarà attiva (oggi ogni prenotazione è una richiesta)
    { title: "Prenota in pochi tocchi", text: "Invii la richiesta per le tue date e il noleggiatore conferma la disponibilità entro 24 ore. Presto, per alcuni mezzi, anche la prenotazione immediata.", visual: <V.VBook /> },
    // Apple Pay / Google Pay: da aggiungere quando i portafogli saranno attivi sul sito
    { title: "Paga in modo semplice", text: "Inserisci la carta una volta sola, al momento della richiesta. L'addebito parte solo quando il noleggiatore accetta.", visual: <V.VPay /> },
    { title: "Tutto nel tuo profilo", text: "Noleggi in corso, richieste in attesa, messaggi e prossimi ritiri: tutto in un unico posto.", visual: <V.VProfile />,
      ctas: v.loggedIn ? [{ label: "Apri i miei noleggi", href: "/account/noleggi", ghost: true }] : undefined },
    { title: "Pronto a partire?", text: "Trova il tuo prossimo mezzo con KeyRent.", visual: <V.VReady />,
      ctas: [{ label: "Cerca un mezzo", href: "/cerca/rapida" }, { label: "Torna alla home", href: "/", ghost: true }] },
  ];
}

function providerSlides(v: Viewer): Slide[] {
  const start: Cta = v.provider ? { label: "Vai alla dashboard", href: "/pro" } : { label: "Registra la tua attività", href: v.loggedIn ? "/pro" : "/registrati?tipo=noleggiatore" };
  return [
    { title: "Registra la tua attività", text: "Inserisci i dati della tua azienda e le sedi da cui noleggi i tuoi mezzi. KeyRent verifica l'attività prima della pubblicazione.", visual: <V.VBusiness />,
      ctas: v.provider ? undefined : [{ label: "Configura la tua attività", href: start.href, ghost: true }] },
    { title: "La tua attività in una dashboard", text: "Ricavi, richieste, noleggi attivi e mezzi disponibili oggi, appena entri.", visual: <V.VDashboard /> },
    { title: "Inserisci il tuo primo mezzo", text: "Foto, caratteristiche, prezzo e condizioni di noleggio, passo dopo passo. Il team KeyRent lo controlla e lo pubblica.", visual: <V.VWizard />,
      ctas: v.provider ? [{ label: "Inserisci un mezzo", href: "/pro/mezzi/nuovo", ghost: true }] : undefined },
    { title: "Hai più mezzi? Pubblicali tutti.", text: "Tutta la flotta in un unico elenco, anche con molti mezzi o più sedi: stato, sede e disponibilità a colpo d'occhio.", visual: <V.VFleet /> },
    { title: "Controlla la disponibilità", text: "Il calendario ti mostra subito quali mezzi sono liberi, prenotati, in attesa di risposta o non disponibili.", visual: <V.VCalendar /> },
    { title: "Usa KeyRent come il tuo gestionale", text: "Mezzi, disponibilità, prenotazioni, ritiri, riconsegne e ricavi, senza cambiare piattaforma.", visual: <V.VAllInOne />,
      strong: "KeyRent non è solo dove pubblichi i tuoi mezzi. È dove gestisci il tuo noleggio." },
    { title: "Ricevi nuovi clienti", text: "KeyRent lavora per dare visibilità ai tuoi mezzi e portarti nuove richieste di noleggio. Ti avvisiamo via email a ogni richiesta.", visual: <V.VNewRequest /> },
    { title: "Gestisci richieste e prenotazioni", text: "Accetti o rifiuti le richieste, vedi i ritiri e le riconsegne di oggi e segui i noleggi attivi, tutto dalla dashboard.", visual: <V.VBookings /> },
    // versamenti automatici al noleggiatore (Stripe Connect): da aggiornare quando saranno attivi
    { title: "Pagamenti chiari", text: "Per ogni prenotazione vedi importo, commissione KeyRent e netto previsto. Il pagamento online è in fase di attivazione: ti avviseremo quando i versamenti automatici sul tuo conto saranno attivi.", visual: <V.VPayout /> },
    { title: "Pubblica. Gestisci. Noleggia.", text: "Gestisci la tua flotta e raggiungi nuovi clienti da un'unica piattaforma.", visual: <V.VReady provider />,
      strong: "KeyRent porta clienti. Tu gestisci tutto da un solo posto.",
      ctas: [start, ...(v.provider ? [{ label: "Inserisci un mezzo", href: "/pro/mezzi/nuovo", ghost: true }] : [{ label: "Scopri di più", href: "/diventa-partner", ghost: true }])] },
  ];
}

export function Guide({ path, viewer }: { path: "cliente" | "noleggiatore"; viewer: Viewer }) {
  const slides = path === "cliente" ? customerSlides(viewer) : providerSlides(viewer);
  const [idx, setIdx] = useState(0);
  const track$ = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<number>());
  const last = slides.length - 1;

  const go = useCallback((i: number) => {
    const el = track$.current;
    if (!el) return;
    const n = Math.max(0, Math.min(last, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [last]);

  useEffect(() => { track("guide_path_selected", { path }); }, [path]);
  useEffect(() => {
    if (seen.current.has(idx)) return;
    seen.current.add(idx);
    track("guide_step_viewed", { path, step: idx + 1 });
    if (idx === last) {
      track("guide_completed", { path });
      try { localStorage.setItem(`kr-guide-${path}`, "done"); } catch { /* niente */ }
    }
  }, [idx, last, path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx]);

  // slide visibile: la decide il browser (IntersectionObserver), non un calcolo sulle misure, così funziona anche su Safari
  useEffect(() => {
    const el = track$.current;
    if (!el) return;
    el.scrollLeft = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setIdx(Number((e.target as HTMLElement).dataset.i));
    }, { root: el, threshold: 0.6 });
    el.querySelectorAll<HTMLElement>("[data-i]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const frame = path === "cliente" ? "phone" : "browser";
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas" aria-roledescription="presentazione" aria-label={path === "cliente" ? "Guida per noleggiare" : "Guida per noleggiatori"}>
      <header className="flex flex-none items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
        <Link href="/" aria-label="KeyRent, home"><Logo className="h-7 w-auto" /></Link>
        <p className="text-sm font-medium text-mute" aria-live="polite">{idx + 1} di {slides.length}</p>
        <Link href="/guida" className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">{idx === last ? "Chiudi" : "Salta"}</Link>
      </header>

      <div ref={track$} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth">
        {slides.map((s, i) => (
          <section key={s.title} data-i={i} aria-roledescription="slide" aria-label={`${i + 1} di ${slides.length}`} aria-hidden={i !== idx}
            className="h-full w-full flex-none snap-center snap-always overflow-y-auto">
            <div className="mx-auto grid min-h-full max-w-6xl content-start gap-6 px-5 pb-6 pt-5 sm:px-8 lg:grid-cols-2 lg:content-center lg:items-center lg:gap-14 lg:py-10">
              <div className="lg:order-1">
                {frame === "phone" ? (
                  <div className="mx-auto w-full max-w-sm lg:rounded-[2.6rem] lg:border-[10px] lg:border-navy-950 lg:bg-canvas lg:p-4 lg:shadow-2xl">
                    <div key={i === idx ? "on" : "off"}>{s.visual}</div>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-sm lg:max-w-none lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:shadow-2xl">
                    <div className="hidden items-center gap-2 border-b border-line bg-canvas px-4 py-2.5 lg:flex">
                      <span className="flex gap-1.5">{[0, 1, 2].map((d) => <span key={d} className="h-2.5 w-2.5 rounded-full bg-navy-100" />)}</span>
                      <span className="ml-3 rounded-md bg-white px-3 py-1 text-xs text-mute">keyrent.it/pro</span>
                    </div>
                    <div className="lg:bg-canvas lg:p-6"><div key={i === idx ? "on" : "off"}>{s.visual}</div></div>
                  </div>
                )}
              </div>
              <div className="space-y-3 lg:order-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">{path === "cliente" ? "Per chi noleggia" : "Per chi mette a noleggio"}</p>
                <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl lg:text-4xl">{s.title}</h2>
                <p className="text-[15px] leading-relaxed text-mute sm:text-base lg:text-lg">{s.text}</p>
                {s.strong && <p className="border-l-4 border-teal-500 pl-3 text-base font-semibold text-navy-900 lg:text-lg">{s.strong}</p>}
                {s.ctas && (
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    {s.ctas.map((c) => (
                      <Link key={c.label} href={c.href} onClick={() => track("guide_cta_clicked", { path, step: i + 1, cta: c.label })}
                        className={`${c.ghost ? "btn-ghost" : "btn-primary"} h-12 rounded-2xl px-6 text-base`}>{c.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <nav aria-label="Navigazione guida" className="flex flex-none items-center justify-between gap-3 border-t border-line bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <button type="button" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Slide precedente"
          className="grid h-12 w-12 place-items-center rounded-full border border-line text-xl text-navy-900 transition hover:bg-navy-50 disabled:opacity-30">←</button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {slides.map((s, i) => (
            <button key={s.title} type="button" onClick={() => go(i)} aria-label={`Vai alla slide ${i + 1}`} aria-current={i === idx}
              className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-teal-500" : "w-2 bg-navy-100 hover:bg-navy-700/30"}`} />
          ))}
        </div>
        {idx < last ? (
          <button type="button" onClick={() => go(idx + 1)} aria-label="Slide successiva"
            className="grid h-12 min-w-12 place-items-center rounded-full bg-navy-900 px-4 text-xl text-white transition hover:bg-navy-800">→</button>
        ) : (
          <Link href="/guida" className="grid h-12 place-items-center rounded-full bg-navy-900 px-5 text-sm font-semibold text-white">Fine</Link>
        )}
      </nav>
    </div>
  );
}
