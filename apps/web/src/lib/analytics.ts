/**
 * Eventi di utilizzo (guida, checkout…). Nessun servizio esterno: l'evento finisce in window.dataLayer
 * e come evento "kr:track" nella pagina, pronto per collegare in futuro uno strumento di statistiche.
 */
export function track(name: string, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  try {
    (w.dataLayer ??= []).push({ event: name, ...props });
    window.dispatchEvent(new CustomEvent("kr:track", { detail: { name, ...props } }));
    if (process.env.NODE_ENV !== "production") console.debug("[track]", name, props);
  } catch { /* gli eventi non devono mai bloccare la pagina */ }
}
