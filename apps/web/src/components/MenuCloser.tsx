"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Chiude i menu a tendina (<details data-menu>) quando cambi pagina o tocchi fuori. */
export function MenuCloser() {
  const path = usePathname();
  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-menu]").forEach((d) => (d.open = false));
  }, [path]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((d) => {
        if (!d.contains(e.target as Node)) d.open = false;
      });
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return null;
}
