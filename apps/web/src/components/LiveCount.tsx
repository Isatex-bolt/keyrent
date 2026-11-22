"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Count } from "./Count";

type Badges = Record<string, number>;
const PROVIDER = ["requests", "provider_bookings", "listings_to_fix", "support"];
const ADMIN = ["admin_reviews", "admin_orgs", "admin_support"];

// archivio condiviso: un solo aggiornamento per tutti i pallini della pagina
let state: Badges | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
function refresh() {
  inflight ??= fetch("/api/badges", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => { if (b) { state = b; listeners.forEach((l) => l()); } })
    .catch(() => undefined)
    .finally(() => { inflight = null; });
  return inflight;
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

function sum(b: Badges, keys: string[]): number {
  return keys.reduce((n: number, k): number => n + (k === "provider" ? sum(b, PROVIDER) : k === "admin" ? sum(b, ADMIN) : b[k] ?? 0), 0);
}

/**
 * Pallino con il numero di novità che si aggiorna da solo: al cambio pagina, quando torni sulla scheda
 * e ogni 30 secondi. `keys`: chiavi dei contatori da sommare ("provider" e "admin" sono gruppi).
 */
export function LiveCount({ keys, initial, className }: { keys: string[]; initial: number; className?: string }) {
  const b = useSyncExternalStore(subscribe, () => state, () => null);
  const path = usePathname();
  useEffect(() => { refresh(); }, [path]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);
  return <Count n={b ? sum(b, keys) : initial} className={className} />;
}
