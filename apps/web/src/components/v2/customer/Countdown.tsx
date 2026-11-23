"use client";

import { useEffect, useState } from "react";

/** Tempo che manca a una scadenza (si aggiorna ogni minuto). */
export function Countdown({ to, label, className }: { to: string; label: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (now === null) return <p className={className}>&nbsp;</p>;
  const m = Math.max(0, Math.round((Date.parse(to) - now) / 60_000));
  const txt = m >= 1440 ? `${Math.floor(m / 1440)} g ${Math.floor((m % 1440) / 60)} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
  return <p className={className}>{label} {txt}</p>;
}
