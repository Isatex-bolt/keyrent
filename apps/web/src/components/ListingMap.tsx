/**
 * Zona del mezzo nella scheda: mappa statica (Mapbox) centrata sulla posizione approssimata, con un cerchio
 * al posto del puntino. L'indirizzo esatto resta riservato fino alla conferma (il noleggiatore è anonimo).
 */
export function ListingMap({ lat, lng, city, province }: { lat: number | null; lng: number | null; city: string; province: string }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (lat == null || lng == null || !token) return null;
  const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lng},${lat},12.3,0/640x320@2x?attribution=false&logo=false&access_token=${token}`;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Dove si trova</h2>
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element -- immagine statica di Mapbox, non serve ottimizzarla */}
        <img src={src} alt={`Mappa della zona di ${city}`} loading="lazy" className="aspect-[2/1] w-full object-cover" />
        <span aria-hidden className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal-500 bg-teal-500/20" />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold shadow">{city} ({province})</span>
      </div>
      <p className="mt-2 text-sm text-mute">Zona indicativa. L&apos;indirizzo esatto di ritiro lo ricevi dopo la conferma del noleggiatore.</p>
    </section>
  );
}
