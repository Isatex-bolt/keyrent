"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** "Cosa c'è vicino a me": chiede la posizione solo quando l'utente preme il pulsante. */
export function NearMe({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  return (
    <button type="button" className={className} disabled={state === "busy"}
      onClick={() => {
        if (!navigator.geolocation) { setState("error"); return; }
        setState("busy");
        navigator.geolocation.getCurrentPosition(
          (p) => router.push(`/cerca?luogo=${encodeURIComponent("Vicino a me")}&lat=${p.coords.latitude.toFixed(4)}&lng=${p.coords.longitude.toFixed(4)}&ordina=distance`),
          () => setState("error"),
          { timeout: 10000, maximumAge: 600_000 },
        );
      }}>
      {state === "busy" ? "Cerco la tua posizione…" : state === "error" ? "Posizione non disponibile: scrivi una città" : children ?? "📍 Cosa c'è vicino a me"}
    </button>
  );
}
