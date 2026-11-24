"use client";

import { Fragment, useEffect, useRef } from "react";

/**
 * Riga orizzontale a scorrimento infinito: finito l'ultimo elemento si riparte dal primo, in entrambe le direzioni.
 * Gli elementi sono ripetuti tre volte e si resta sempre nella copia centrale (salto invisibile).
 */
export function LoopRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div ref={ref} className={`no-scrollbar flex overflow-x-auto ${className}`}>
      {[0, 1, 2].map((k) => <Fragment key={k}>{children}</Fragment>)}
    </div>
  );
}
