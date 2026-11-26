"use client";

import { Fragment, useEffect, useRef } from "react";

/**
 * Riga orizzontale a scorrimento infinito: finito l'ultimo elemento si riparte dal primo, in entrambe le direzioni.
 * Gli elementi sono ripetuti tre volte e si resta sempre nella copia centrale (salto invisibile).
 * Con `auto` avanza da sola di una scheda ogni `everyMs`; si ferma quando la tocchi o ci passi sopra e riparte dopo qualche secondo.
 * Chi ha chiesto meno animazioni al telefono (riduci movimento) la vede ferma.
 */
export function LoopRow({ children, className = "", auto = false, everyMs = 3000 }: { children: React.ReactNode; className?: string; auto?: boolean; everyMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => el.scrollWidth / 3;
    el.scrollLeft = set();
    let busy = false;
    const onScroll = () => {
      if (busy) return;
      const w = set();
      if (el.scrollLeft < w * 0.5 || el.scrollLeft > w * 1.5) {
        busy = true;
        el.scrollLeft += el.scrollLeft < w * 0.5 ? w : -w;
        requestAnimationFrame(() => { busy = false; });
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    // scorrimento automatico
    let timer: ReturnType<typeof setInterval> | undefined;
    let resume: ReturnType<typeof setTimeout> | undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      if (first && document.visibilityState === "visible") el.scrollBy({ left: first.offsetWidth + gap, behavior: "smooth" });
    };
    const start = () => { if (auto && !reduce && !timer) timer = setInterval(step, everyMs); };
    const stop = () => { clearInterval(timer); timer = undefined; clearTimeout(resume); };
    const pause = () => { stop(); resume = setTimeout(start, 6000); };
    start();
    el.addEventListener("pointerdown", pause, { passive: true });
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });
    el.addEventListener("mouseenter", stop);
    el.addEventListener("mouseleave", pause);
    return () => {
      stop();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("wheel", pause);
      el.removeEventListener("mouseenter", stop);
      el.removeEventListener("mouseleave", pause);
    };
  }, [auto, everyMs]);
  return (
    <div ref={ref} className={`no-scrollbar flex overflow-x-auto ${className}`}>
      {[0, 1, 2].map((k) => <Fragment key={k}>{children}</Fragment>)}
    </div>
  );
}
