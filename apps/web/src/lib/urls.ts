export function listingHref(l: { id: string; slug: string }, keep?: URLSearchParams) {
  const q = new URLSearchParams();
  for (const k of ["luogo", "dal", "al", "ora_ritiro", "ora_riconsegna"]) {
    const v = keep?.get(k);
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return `/mezzo/${l.slug}-${l.id}${qs ? `?${qs}` : ""}`;
}

/** Estrae l'uuid finale da "/mezzo/laika-kosmo-<uuid>". */
export function idFromRef(ref: string) {
  const m = ref.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return m?.[1] ?? null;
}

export function withParams(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
  return `?${q.toString()}`;
}
