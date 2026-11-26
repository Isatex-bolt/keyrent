"use client";

import { Fragment, useEffect, useRef } from "react";

/**
 * Riga orizzontale a scorrimento infinito: finito l'ultimo elemento si riparte dal primo, in entrambe le direzioni.
 * Gli elementi sono ripetuti tre volte e si resta sempre nella copia centrale (salto invisibile).
 * Con `auto` scorre da sola, continua e lenta (`speed` pixel al secondo); si ferma quando la tocchi o ci passi sopra e riparte dopo qualche secondo.
 * Chi ha chiesto meno animazioni al telefono (riduci movimento) la vede ferma.
 */
export function LoopRow({ children, className = "", auto = false, speed = 30 }: { children: React.ReactNode; className?: string; auto?: boolean; speed?: number }) {
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

    // scorrimento automatico continuo e lento (pixel al secondo); durante il movimento niente "aggancio" alle schede
    let raf = 0, last = 0, pos = 0;
    let resume: ReturnType<typeof setTimeout> | undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const snap = el.style.scrollSnapType;
    const frame = (t: number) => {
      if (last && document.visibilityState === "visible") {
        pos += (speed * Math.min(t - last, 100)) / 1000;
        el.scrollLeft = pos;
        if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft; // dopo il salto del giro infinito
      }
      last = t;
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!auto || reduce || raf) return;
      el.style.scrollSnapType = "none";
      pos = el.scrollLeft; last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; clearTimeout(resume); el.style.scrollSnapType = snap; };
    const pause = () => { stop(); resume = setTimeout(start, 4000); };
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
  }, [auto, speed]);
  return (
    <div ref={ref} className={`no-scrollbar flex overflow-x-auto ${className}`}>
      {[0, 1, 2].map((k) => <Fragment key={k}>{children}</Fragment>)}
    </div>
  );
}
