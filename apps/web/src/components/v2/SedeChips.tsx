"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Filtro per sede (aggiorna ?sede= mantenendo gli altri parametri). Visibile solo con più sedi. */
export function SedeChips({ locations, sede }: { locations: { id: string; name: string }[]; sede: string }) {
  const path = usePathname(); const sp = useSearchParams(); const router = useRouter();
  if (locations.length < 2) return null;
  const go = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    if (id === "tutte") p.delete("sede"); else p.set("sede", id);
    const s = p.toString();
    router.push(`${path}${s ? `?${s}` : ""}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {[{ id: "tutte", name: "Tutte le sedi" }, ...locations].map((l) => (
        <button key={l.id} onClick={() => go(l.id)} className={`chip ${sede === l.id ? "chip-on" : ""}`}>{l.name}</button>
      ))}
    </div>
  );
}
